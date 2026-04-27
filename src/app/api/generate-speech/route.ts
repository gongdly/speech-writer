import { NextRequest, NextResponse } from "next/server";
import { callLLM, LLMError } from "@/lib/llm/client";
import type { LLMProvider } from "@/lib/llm/types";
import {
  buildSpeechPrompt,
  type SpeechGenerationInput,
} from "@/lib/prompts/builder";
import { listRagContextsBySession } from "@/lib/rag-cache";
import { createDraft } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 한도 (60초)

/**
 * POST /api/generate-speech
 *
 * 5-Layer 프롬프트로 AI 본문 생성 후 Supabase drafts 테이블에 저장.
 *
 * Body:
 *   {
 *     sessionId: string,
 *     provider: "anthropic" | "gemini" | "openai",
 *     model: string,
 *     apiKey: string,
 *     formData: SpeechGenerationInput  // 폼 입력값
 *   }
 *
 * Response:
 *   {
 *     draftId: string,
 *     content: string,        // 생성된 마크다운 본문
 *     charCount: number,
 *     metadata: {
 *       provider, model, inputTokens, outputTokens, generationTimeMs
 *     }
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
      formData: Omit<SpeechGenerationInput, "contexts">;
    };

    const { sessionId, provider, model, apiKey, formData } = body;

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

    // 5-Layer 프롬프트 조립
    const { systemPrompt, userPrompt, estimatedInputTokens } =
      buildSpeechPrompt({
        ...formData,
        contexts,
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
      }),
      status: "draft",
    });

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
