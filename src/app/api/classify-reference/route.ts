import { NextRequest, NextResponse } from "next/server";
import { getRagContext, saveRagContext } from "@/lib/rag-cache";
import { createServerClient } from "@/lib/supabase/server";
import { callLLM, LLMError } from "@/lib/llm/client";
import type { LLMProvider } from "@/lib/llm/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, fileId, provider, model, apiKey } =
      (await req.json()) as {
        sessionId: string;
        fileId: string;
        provider: LLMProvider;
        model: string;
        apiKey: string;
      };

    if (!sessionId || !fileId) {
      return NextResponse.json(
        { error: "sessionId·fileId 필수" },
        { status: 400 },
      );
    }

    if (!provider || !model || !apiKey) {
      return NextResponse.json(
        {
          error:
            "provider·model·apiKey 필수 — 설정 페이지에서 API 키를 등록해 주세요",
        },
        { status: 400 },
      );
    }

    const ctx = await getRagContext(sessionId, fileId);
    if (!ctx) {
      return NextResponse.json(
        { error: "파일 컨텍스트 없음" },
        { status: 404 },
      );
    }

    const truncatedText = ctx.text.slice(0, 4000);

    const userPrompt = `다음 본문을 5가지 분류 중 하나로 자동 분류하고, 통계 자료라면 주요 수치도 추출하세요.

# 분류 5종
- policy_plan: 정책 추진계획서·보고서 (정책 배경·내용·일정 등 본문)
- statistics: 통계·인용 자료 (수치·전문가 발언·사례 중심)
- previous_speech: 이전 말씀자료 (축사·기념사 등 발화 텍스트)
- bio: 참석자 약력 (인물 직책·이력 정보)
- other: 기타

# 응답 형식
순수 JSON만 응답:
{
  "category": "policy_plan",
  "confidence": 0.85,
  "extractedStats": [
    { "label": "민원 처리시간", "value": "50% 단축" }
  ]
}

extractedStats는 statistics 분류일 때만 채우고, 다른 분류면 빈 배열 [].
최대 5개까지만 추출.

# 본문
${truncatedText}`;

    try {
      const response = await callLLM({
        provider,
        model,
        apiKey,
        userPrompt,
        maxTokens: 1024,
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json(
          { error: "AI 응답을 파싱할 수 없습니다", raw: response.text },
          { status: 500 },
        );
      }

      const result = JSON.parse(jsonMatch[0]) as {
        category: string;
        confidence: number;
        extractedStats?: Array<{ label: string; value: string }>;
      };

      // 분류 결과를 RAG 컨텍스트에 반영
      await saveRagContext(sessionId, fileId, {
        ...ctx,
        category: result.category,
        extractedStats: result.extractedStats
          ? Object.fromEntries(
              result.extractedStats.map((s) => [s.label, s.value]),
            )
          : undefined,
      });

      // DB 메타도 갱신
      const sb = createServerClient();
      await sb
        .from("uploaded_files")
        .update({
          detected_category: result.category,
          category_confidence: result.confidence,
          extracted_stats: result.extractedStats
            ? JSON.stringify(result.extractedStats)
            : null,
        })
        .eq("id", fileId);

      return NextResponse.json(result);
    } catch (e) {
      if (e instanceof LLMError) {
        return NextResponse.json(
          { error: e.userMessage },
          { status: e.statusCode },
        );
      }
      throw e;
    }
  } catch (e) {
    console.error("Classify failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "분류 실패" },
      { status: 500 },
    );
  }
}
