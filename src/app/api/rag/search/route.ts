import { NextRequest, NextResponse } from "next/server";
import { embedText, resolveGeminiKey } from "@/lib/rag/embedding";
import { searchSimilarChunks } from "@/lib/rag/db";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/rag/search
 *
 * 자연어 질의로 관련 정책브리핑·보도자료 청크 검색.
 *
 * Body:
 *   {
 *     query: string,                  // 검색 질의
 *     apiKey?: string,                // 사용자 Gemini 키 (없으면 서버 키 사용)
 *     filterMinistries?: string[],    // 부처 필터
 *     matchCount?: number,            // 기본 5
 *     similarityThreshold?: number,   // 기본 0.5
 *   }
 *
 * Response:
 *   { results: MatchedChunk[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      query: string;
      apiKey?: string;
      filterMinistries?: string[];
      matchCount?: number;
      similarityThreshold?: number;
    };

    if (!body.query?.trim()) {
      return NextResponse.json(
        { error: "검색 질의가 필요합니다" },
        { status: 400 },
      );
    }

    const geminiKey = resolveGeminiKey(body.apiKey);

    // 질의 임베딩
    const queryEmbedding = await embedText(body.query, {
      apiKey: geminiKey,
      taskType: "RETRIEVAL_QUERY",
    });

    // 벡터 검색
    const results = await searchSimilarChunks({
      queryEmbedding,
      matchCount: body.matchCount ?? 5,
      similarityThreshold: body.similarityThreshold ?? 0.5,
      filterMinistries: body.filterMinistries,
    });

    return NextResponse.json({
      query: body.query,
      resultCount: results.length,
      results,
    });
  } catch (e) {
    console.error("RAG search failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "검색 실패" },
      { status: 500 },
    );
  }
}
