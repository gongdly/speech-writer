import { NextRequest, NextResponse } from "next/server";
import { callLLM, LLMError } from "@/lib/llm/client";
import type { LLMProvider } from "@/lib/llm/types";
import {
  buildSpeechPrompt,
  type SpeechGenerationInput,
} from "@/lib/prompts/builder";
import { listRagContextsBySession } from "@/lib/rag-cache";
import { createDraft } from "@/lib/db";
import { embedText, resolveGeminiKey } from "@/lib/rag/embedding";
import { searchSimilarChunks, type MatchedChunk } from "@/lib/rag/db";
import {
  getPersona,
  incrementPersonaUsage,
} from "@/lib/personas/db";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 한도 (60초)

/**
 * 행사 정보로 RAG 검색 질의 만들기
 *
 * 우선순위가 높은 정보를 조합:
 *   - 행사명 (가장 구체적)
 *   - 핵심 메시지 (사용자 입력)
 *   - 발화자 소속 (부처 컨텍스트)
 */
function buildRagQuery(
  formData: Omit<SpeechGenerationInput, "contexts">,
): string {
  const parts: string[] = [];
  if (formData.eventName) parts.push(formData.eventName);
  if (formData.keyMessages && formData.keyMessages.length > 0) {
    parts.push(formData.keyMessages.join(" "));
  }
  if (formData.speakerOrganization) {
    parts.push(formData.speakerOrganization);
  }
  return parts.join(" ").slice(0, 500);
}

/**
 * 발화자 소속에서 부처명 추정
 *
 * "행정안전부 정보화담당관" → "행정안전부"
 * 추정 실패하면 null (필터 미적용 → 정책브리핑만 검색)
 */
function inferMinistry(speakerOrg?: string): string | null {
  if (!speakerOrg) return null;
  const ministries = [
    "행정안전부",
    "고용노동부",
    "보건복지부",
    "교육부",
    "국토교통부",
    "기획재정부",
    "외교부",
    "국방부",
    "과학기술정보통신부",
    "농림축산식품부",
    "산업통상자원부",
    "환경부",
    "여성가족부",
    "문화체육관광부",
    "해양수산부",
    "통일부",
    "법무부",
  ];
  return ministries.find((m) => speakerOrg.includes(m)) ?? null;
}

/**
 * RAG 검색 결과를 컨텍스트 텍스트로 포맷
 */
function formatRagContext(matches: MatchedChunk[]): string {
  if (matches.length === 0) return "";

  const sections = matches.map((m, idx) => {
    const date = m.article_pub_date
      ? new Date(m.article_pub_date).toISOString().slice(0, 10)
      : "날짜 미상";
    return `[참고자료 ${idx + 1}] ${m.source_name} (${date})
제목: ${m.article_title}
내용: ${m.content}`;
  });

  return sections.join("\n\n---\n\n");
}

/**
 * POST /api/generate-speech
 *
 * 5-Layer 프롬프트로 AI 본문 생성 후 Supabase drafts 테이블에 저장.
 * v0.8부터 RAG 자동 적용.
 *
 * Body:
 *   {
 *     sessionId: string,
 *     provider: "anthropic" | "gemini" | "openai",
 *     model: string,
 *     apiKey: string,
 *     formData: SpeechGenerationInput,
 *     useRag?: boolean,                  // 기본 false (보도자료 도구에서 별도 사용 권장)
 *     ragMatchCount?: number,            // 기본 5
 *     userGeminiKey?: string,            // RAG 임베딩용 (없으면 서버 키 fallback)
 *   }
 *
 * Response:
 *   {
 *     draftId, content, charCount,
 *     metadata: { provider, model, inputTokens, outputTokens, generationTimeMs },
 *     ragSources?: Array<{                // 사용된 출처 (UI에 표시)
 *       title, link, sourceName, ministry, pubDate, similarity
 *     }>
 *   }
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = (await req.json()) as {
      sessionId: string;
      provider: LLMProvider;
      model: string;
      apiKey: string;
      formData: Omit<SpeechGenerationInput, "contexts" | "persona">;
      useRag?: boolean;
      ragMatchCount?: number;
      userGeminiKey?: string;
      personaId?: string; // 발화자 페르소나 ID (선택)
    };

    const {
      sessionId,
      provider,
      model,
      apiKey,
      formData,
      useRag = false,
      ragMatchCount = 5,
      userGeminiKey,
      personaId,
    } = body;

    // 입력 검증
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId 필수" },
        { status: 400 },
      );
    }
    if (!provider || !model || !apiKey) {
      return NextResponse.json(
        { error: "API 키 설정이 필요합니다 (설정 페이지에서 등록)" },
        { status: 400 },
      );
    }
    if (!formData?.eventName || !formData?.eventType) {
      return NextResponse.json(
        { error: "행사명·행사 유형은 필수입니다" },
        { status: 400 },
      );
    }

    // 업로드된 컨텍스트 가져오기 (있으면 자동 활용)
    const contexts = await listRagContextsBySession(sessionId);

    // RAG 자동 검색 (정책브리핑 + 부처 보도자료)
    let ragMatches: MatchedChunk[] = [];
    if (useRag) {
      try {
        const geminiKey = resolveGeminiKey(userGeminiKey);
        const ragQuery = buildRagQuery(formData);
        if (ragQuery.trim().length > 0) {
          const queryEmbedding = await embedText(ragQuery, {
            apiKey: geminiKey,
            taskType: "RETRIEVAL_QUERY",
          });

          const ministry = inferMinistry(formData.speakerOrganization);
          ragMatches = await searchSimilarChunks({
            queryEmbedding,
            matchCount: ragMatchCount,
            similarityThreshold: 0.5,
            filterMinistries: ministry ? [ministry] : undefined,
          });
        }
      } catch (ragError) {
        // RAG 실패해도 본문 생성은 진행 (RAG는 선택적 보강)
        console.warn("RAG search failed (non-fatal):", ragError);
      }
    }

    // RAG 결과를 컨텍스트로 추가
    const ragContextText = formatRagContext(ragMatches);
    const enrichedContexts = ragContextText
      ? [
          ...contexts,
          {
            fileId: "_rag_auto",
            fileName: `정책브리핑·보도자료 자동 참고 (${ragMatches.length}건)`,
            fileType: "reference" as const,
            category: "rag_auto",
            text: ragContextText,
          },
        ]
      : contexts;

    // 페르소나 로드 (선택)
    let persona = null;
    if (personaId) {
      try {
        const fullPersona = await getPersona(personaId);
        if (fullPersona) {
          persona = {
            name: fullPersona.name,
            organization: fullPersona.organization,
            role: fullPersona.role,
            tone: fullPersona.tone,
            speech_style: fullPersona.speech_style,
            preferred_phrases: fullPersona.preferred_phrases,
            avoided_phrases: fullPersona.avoided_phrases,
            preferred_topics: fullPersona.preferred_topics,
            custom_instructions: fullPersona.custom_instructions,
          };
        }
      } catch (e) {
        console.warn("Persona load failed (non-fatal):", e);
      }
    }

    // 5-Layer 프롬프트 조립
    const { systemPrompt, userPrompt, estimatedInputTokens } =
      buildSpeechPrompt({
        ...formData,
        contexts: enrichedContexts,
        persona: persona ?? undefined,
      });

    // 컨텍스트가 너무 크면 경고
    if (estimatedInputTokens > 150000) {
      return NextResponse.json(
        {
          error: `컨텍스트가 너무 큽니다 (약 ${estimatedInputTokens.toLocaleString()} 토큰). 참고자료 일부를 삭제해 주세요.`,
        },
        { status: 400 },
      );
    }

    // AI 호출
    let response;
    try {
      response = await callLLM({
        provider,
        model,
        apiKey,
        systemPrompt,
        userPrompt,
        // 출력 토큰: 목표 글자수 × 1.5(토큰비) × 1.3(여유) + 메타데이터 분량
        maxTokens: Math.min(
          Math.ceil(formData.targetChars * 1.5 * 1.3) + 500,
          8000,
        ),
        temperature: 0.7,
      });
    } catch (e) {
      if (e instanceof LLMError) {
        return NextResponse.json(
          { error: e.userMessage },
          { status: e.statusCode },
        );
      }
      throw e;
    }

    const generationTimeMs = Date.now() - startTime;
    const charCount = response.text.replace(/\s/g, "").length;

    // Supabase drafts에 저장
    const ragSources = ragMatches.map((m) => ({
      title: m.article_title,
      link: m.article_link,
      sourceName: m.source_name,
      ministry: m.article_ministry,
      pubDate: m.article_pub_date,
      similarity: Math.round(m.similarity * 1000) / 1000,
    }));

    const draft = await createDraft({
      session_id: sessionId,
      event_name: formData.eventName,
      event_date: formData.eventDate ?? null,
      event_location: formData.eventLocation ?? null,
      event_type: formData.eventType,
      speaker_role: formData.speakerRole,
      speaker_organization: formData.speakerOrganization ?? null,
      audience: JSON.stringify(formData.audience),
      length_option: formData.lengthOption,
      target_chars: formData.targetChars,
      input_data: JSON.stringify({
        keyMessages: formData.keyMessages ?? [],
        citedStats: formData.citedStats ?? "",
        avoidExpressions: formData.avoidExpressions ?? [],
        attendees: formData.attendees ?? [],
      }),
      has_event_plan: contexts.some((c) => c.fileType === "plan") ? 1 : 0,
      reference_count: contexts.filter((c) => c.fileType === "reference")
        .length,
      draft_md: response.text,
      draft_meta: JSON.stringify({
        provider: response.provider,
        model: response.model,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        generationTimeMs,
        charCount,
        ragUsed: ragSources.length > 0,
        ragSources,
        personaUsed: persona?.name ?? null,
      }),
      status: "draft",
      persona_id: personaId ?? null,
    });

    // 페르소나 사용 카운트 증가 (비동기, 실패해도 무시)
    if (personaId) {
      incrementPersonaUsage(personaId).catch(() => {});
    }

    return NextResponse.json({
      draftId: draft.id,
      content: response.text,
      charCount,
      metadata: {
        provider: response.provider,
        model: response.model,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        generationTimeMs,
      },
      ragSources,
    });
  } catch (e) {
    console.error("Generate speech failed:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "본문 생성 실패",
      },
      { status: 500 },
    );
  }
}
