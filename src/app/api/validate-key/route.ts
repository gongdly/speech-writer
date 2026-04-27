import { NextRequest, NextResponse } from "next/server";
import { callLLM, LLMError } from "@/lib/llm/client";
import type { LLMProvider } from "@/lib/llm/types";

export const runtime = "nodejs";

/**
 * POST /api/validate-key
 *
 * 사용자가 입력한 API 키가 유효한지 검증한다.
 * 각 provider에 짧은 ping 요청을 보내 200이 돌아오는지 확인.
 *
 * Body:
 *   { provider: "anthropic" | "gemini" | "openai", apiKey: string }
 *
 * Response (성공):
 *   { valid: true, provider, model }
 *
 * Response (실패):
 *   { valid: false, error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey } = (await req.json()) as {
      provider: LLMProvider;
      apiKey: string;
    };

    if (!provider || !apiKey) {
      return NextResponse.json(
        { valid: false, error: "provider·apiKey 필수" },
        { status: 400 },
      );
    }

    // 각 provider별로 가장 저렴한 모델로 ping
    const pingModel: Record<LLMProvider, string> = {
      anthropic: "claude-haiku-4-5-20251001",
      gemini: "gemini-2.5-flash",
      openai: "gpt-5-mini",
    };

    try {
      await callLLM({
        provider,
        model: pingModel[provider],
        apiKey,
        userPrompt: "ping",
        maxTokens: 10,
      });

      return NextResponse.json({
        valid: true,
        provider,
        model: pingModel[provider],
      });
    } catch (e) {
      if (e instanceof LLMError) {
        return NextResponse.json({
          valid: false,
          error: e.userMessage,
          statusCode: e.statusCode,
        });
      }
      throw e;
    }
  } catch (e) {
    return NextResponse.json(
      {
        valid: false,
        error: e instanceof Error ? e.message : "검증 실패",
      },
      { status: 500 },
    );
  }
}
