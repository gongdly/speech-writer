import { NextRequest, NextResponse } from "next/server";
import { getRagContext } from "@/lib/rag-cache";
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
        { error: "파일 컨텍스트 없음 (만료되었을 수 있음)" },
        { status: 404 },
      );
    }

    const truncatedText = ctx.text.slice(0, 5000);

    const userPrompt = `다음은 정부·공공기관의 행사 계획서 본문입니다. 이 문서에서 행사 정보를 추출해 JSON 형식으로 응답하세요.

# 추출 항목 (모두 선택, 없으면 null)
- eventName: 행사명 (정확한 명칭, 예: "「2026 전자정부의 날 기념식」")
- eventDate: 일시 (YYYY-MM-DDTHH:mm 형식, 시간 없으면 YYYY-MM-DD)
- eventLocation: 장소
- speakerRole: 발화자 직급 (다음 중 하나) — minister(장관)/vice_minister(차관)/director_general(실장·국장)/director(과장·팀장)/head_of_org(기관장)/null
- speakerOrganization: 발화자 소속 (예: "행정안전부", "○○시청")
- attendees: 주요 참석자 [{ name, role }] (직급 순)
- keyMessages: 핵심 메시지 배열 (최대 3개, 행사가 강조하려는 메시지)
- citedStats: 본문에 등장하는 인용할 만한 통계·일화 (최대 500자, 없으면 null)
- confidence: 추출 신뢰도 (0~1, 본문이 행사계획서가 아니면 낮게)

# 응답 형식
오직 JSON만 응답하세요. 설명 텍스트 없이 \`\`\`json 블록도 없이 순수 JSON만.

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

      const extracted = JSON.parse(jsonMatch[0]);
      return NextResponse.json(extracted);
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
    console.error("Extract failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "추출 실패" },
      { status: 500 },
    );
  }
}
