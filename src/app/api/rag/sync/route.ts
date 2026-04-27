import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  listActiveRssSources,
  findExistingArticleGuids,
  insertArticle,
  insertChunks,
  updateRssSourceStatus,
  startSyncLog,
  finishSyncLog,
  deleteArticlesOlderThan,
} from "@/lib/rag/db";
import { fetchAndParseRss } from "@/lib/rag/rss-parser";
import {
  embedTextBatch,
  resolveGeminiKey,
  chunkText,
} from "@/lib/rag/embedding";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Pro 5분 (Hobby는 60초 한계 있음)

/**
 * POST /api/rag/sync
 *
 * 등록된 모든 활성 RSS 소스를 동기화.
 * 새 기사를 가져와 청크 분할 후 임베딩 생성하여 저장.
 *
 * 호출 방식:
 *   1. Vercel Cron: 매일 새벽 3시 자동 호출 (vercel.json 참조)
 *   2. 수동: 어드민 페이지에서 "지금 동기화" 버튼
 *
 * Headers:
 *   - x-rag-sync-secret: 환경변수 RAG_SYNC_SECRET와 일치해야 함 (선택)
 *   - Authorization: "Bearer <CRON_SECRET>" (Vercel Cron 표준)
 *
 * Body (선택):
 *   { sourceIds?: string[], forceAll?: boolean }
 *
 * Response:
 *   {
 *     success: boolean,
 *     summary: {
 *       sourcesProcessed: number,
 *       totalNewArticles: number,
 *       totalEmbeddedChunks: number,
 *       errors: string[],
 *       cleanedOldArticles: number,
 *       elapsedMs: number,
 *     },
 *     details: Array<{ sourceId, sourceName, status, newCount, embeddedCount, error? }>
 *   }
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // 인증 확인 (Vercel Cron이 자동으로 Authorization 헤더 보냄)
  const cronSecret = process.env.CRON_SECRET;
  const ragSyncSecret = process.env.RAG_SYNC_SECRET;
  const authHeader = req.headers.get("authorization");
  const customHeader = req.headers.get("x-rag-sync-secret");

  const isCronAuthorized =
    cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isManualAuthorized =
    ragSyncSecret && customHeader === ragSyncSecret;

  // 둘 중 하나라도 설정되어 있으면 검증
  if ((cronSecret || ragSyncSecret) && !isCronAuthorized && !isManualAuthorized) {
    return NextResponse.json(
      { error: "인증 실패" },
      { status: 401 },
    );
  }

  let geminiKey: string;
  try {
    geminiKey = resolveGeminiKey();
  } catch (e) {
    return NextResponse.json(
      {
        error: "Gemini API 키 미설정",
        hint: "Vercel 환경변수 GEMINI_API_KEY를 설정하세요",
      },
      { status: 500 },
    );
  }

  // 1년 이상 된 기사 정리
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  let cleanedCount = 0;
  try {
    cleanedCount = await deleteArticlesOlderThan(oneYearAgo);
  } catch (e) {
    console.warn("Old article cleanup failed (non-fatal):", e);
  }

  // 활성 소스 조회
  let sources;
  try {
    sources = await listActiveRssSources();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "소스 조회 실패" },
      { status: 500 },
    );
  }

  // 요청 본문에서 특정 소스만 동기화 옵션
  let body: { sourceIds?: string[]; forceAll?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // body 없어도 무방
  }

  const targetSources = body.sourceIds
    ? sources.filter((s) => body.sourceIds!.includes(s.id))
    : sources;

  const details: Array<{
    sourceId: string;
    sourceName: string;
    status: string;
    fetchedCount: number;
    newCount: number;
    embeddedCount: number;
    error?: string;
  }> = [];

  let totalNewArticles = 0;
  let totalEmbeddedChunks = 0;
  const errors: string[] = [];

  for (const source of targetSources) {
    const logId = await startSyncLog(source.id).catch(() => null);
    let fetchedCount = 0;
    let newCount = 0;
    let embeddedCount = 0;

    try {
      // RSS 가져와서 파싱
      const articles = await fetchAndParseRss(source.rss_url);
      fetchedCount = articles.length;

      // 1년 이상 된 기사 제외
      const recentArticles = articles.filter(
        (a) => !a.pubDate || a.pubDate >= oneYearAgo,
      );

      // 이미 있는 guid 제외
      const guids = recentArticles.map((a) => a.guid);
      const existingGuids = await findExistingArticleGuids(guids);
      const newArticles = recentArticles.filter(
        (a) => !existingGuids.has(a.guid),
      );

      // 새 기사 처리
      for (const article of newArticles) {
        const inserted = await insertArticle({
          source_id: source.id,
          title: article.title,
          link: article.link,
          pub_date: article.pubDate,
          content: article.content,
          description: article.description,
          ministry: source.ministry,
          guid: article.guid,
        });
        newCount++;

        // 청크 분할
        const fullText = [article.title, article.content]
          .filter(Boolean)
          .join("\n\n");
        const chunks = chunkText(fullText, { chunkSize: 500, overlap: 50 });

        if (chunks.length === 0) continue;

        // 임베딩 (배치, 최대 100개씩)
        try {
          const embeddings = await embedTextBatch(chunks, {
            apiKey: geminiKey,
            taskType: "RETRIEVAL_DOCUMENT",
            title: article.title,
          });

          // 청크 + 임베딩 저장
          const chunkRows = chunks.map((content, idx) => ({
            id: `c_${nanoid(12)}`,
            article_id: inserted.id,
            chunk_idx: idx,
            content,
            embedding: embeddings[idx],
            token_count: Math.ceil(content.length / 2.5), // 한국어 거친 추정
            created_at: Date.now(),
          }));

          await insertChunks(chunkRows);
          embeddedCount += chunks.length;
        } catch (embedError) {
          console.error(
            `Embedding failed for article ${inserted.id}:`,
            embedError,
          );
          // 청크 임베딩 실패해도 기사는 살림 (다음 동기화에서 재시도 가능)
        }

        // Gemini 분당 한도 보호 (요청간 짧은 sleep)
        if (newCount % 10 === 0) {
          await sleep(1000);
        }
      }

      await updateRssSourceStatus(source.id, "ok", fetchedCount);
      if (logId) {
        await finishSyncLog(logId, {
          status: "ok",
          fetchedCount,
          newCount,
          embeddedCount,
        });
      }

      details.push({
        sourceId: source.id,
        sourceName: source.name,
        status: "ok",
        fetchedCount,
        newCount,
        embeddedCount,
      });

      totalNewArticles += newCount;
      totalEmbeddedChunks += embeddedCount;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      const fullMsg = `${source.name}: ${errorMsg}`;
      errors.push(fullMsg);
      console.error(`Sync failed for ${source.id}:`, e);

      await updateRssSourceStatus(source.id, `error: ${errorMsg}`).catch(() => {
        /* 무시 */
      });
      if (logId) {
        await finishSyncLog(logId, {
          status: "error",
          fetchedCount,
          newCount,
          embeddedCount,
          errorMessage: errorMsg,
        }).catch(() => {});
      }

      details.push({
        sourceId: source.id,
        sourceName: source.name,
        status: "error",
        fetchedCount,
        newCount,
        embeddedCount,
        error: errorMsg,
      });
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    summary: {
      sourcesProcessed: targetSources.length,
      totalNewArticles,
      totalEmbeddedChunks,
      errors,
      cleanedOldArticles: cleanedCount,
      elapsedMs: Date.now() - startTime,
    },
    details,
  });
}

/**
 * Vercel Cron이 GET으로 호출하는 경우도 지원
 */
export async function GET(req: NextRequest) {
  return POST(req);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
