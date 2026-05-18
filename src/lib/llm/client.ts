/**
 * 통합 LLM 클라이언트
 *
 * 3종 provider(Anthropic / Gemini / OpenAI)에 대한 호출을
 * 공통 인터페이스로 추상화한다.
 *
 * Cloudflare Workers 환경에서 동작 가능하도록
 * fetch API만 사용 (SDK 의존성 X).
 */

import type { LLMRequest, LLMResponse } from "./types";

/**
 * 통합 호출 함수 - provider에 따라 자동 분기
 */
export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  switch (req.provider) {
    case "anthropic":
      return callAnthropic(req);
    case "gemini":
      return callGemini(req);
    case "openai":
      return callOpenAI(req);
    default:
      throw new Error(`Unsupported provider: ${(req as LLMRequest).provider}`);
  }
}

/**
 * Anthropic Claude API 호출
 */
async function callAnthropic(req: LLMRequest): Promise<LLMResponse> {
  const messages = [
    {
      role: "user" as const,
      content: req.userPrompt,
    },
  ];

  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? 1024,
    messages,
  };

  if (req.systemPrompt) {
    body.system = req.systemPrompt;
  }

  if (req.temperature !== undefined) {
    body.temperature = req.temperature;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": req.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LLMError(
      `Anthropic API error (${response.status}): ${errorText}`,
      response.status,
      "anthropic",
    );
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");

  return {
    text,
    provider: "anthropic",
    model: req.model,
    usage: {
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    },
  };
}

/**
 * Google Gemini API 호출
 */
async function callGemini(req: LLMRequest): Promise<LLMResponse> {
  const contents = [
    {
      role: "user",
      parts: [{ text: req.userPrompt }],
    },
  ];

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: req.maxTokens ?? 1024,
      ...(req.temperature !== undefined && { temperature: req.temperature }),
      // Gemini 2.5 Flash/Pro는 기본적으로 thinking이 활성화되어 있어
      // thinking 토큰이 maxOutputTokens를 잠식해 빈 응답을 반환하는 경우가 있다.
      // 구조화 추출 작업에서는 thinking이 불필요하므로 비활성화한다.
      // 참고: https://ai.google.dev/gemini-api/docs/thinking
      ...(req.model.startsWith("gemini-2.5") && {
        thinkingConfig: { thinkingBudget: 0 },
      }),
    },
  };

  if (req.systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: req.systemPrompt }],
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:generateContent?key=${req.apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LLMError(
      `Gemini API error (${response.status}): ${errorText}`,
      response.status,
      "gemini",
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };

  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  return {
    text,
    provider: "gemini",
    model: req.model,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    },
  };
}

/**
 * OpenAI GPT API 호출
 */
async function callOpenAI(req: LLMRequest): Promise<LLMResponse> {
  const messages: Array<{ role: string; content: string }> = [];

  if (req.systemPrompt) {
    messages.push({ role: "system", content: req.systemPrompt });
  }
  messages.push({ role: "user", content: req.userPrompt });

  const body: Record<string, unknown> = {
    model: req.model,
    messages,
    max_completion_tokens: req.maxTokens ?? 1024,
  };

  if (req.temperature !== undefined) {
    body.temperature = req.temperature;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LLMError(
      `OpenAI API error (${response.status}): ${errorText}`,
      response.status,
      "openai",
    );
  }

  const data = (await response.json()) as {
    choices: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    };
  };

  const text = data.choices[0]?.message?.content ?? "";

  return {
    text,
    provider: "openai",
    model: req.model,
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    },
  };
}

/**
 * LLM 호출 시 발생하는 에러 (provider 무관 통합 타입)
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public provider: string,
  ) {
    super(message);
    this.name = "LLMError";
  }

  /** 사용자에게 보여줄 친화적인 에러 메시지 */
  get userMessage(): string {
    if (this.statusCode === 401) {
      return `API 키가 유효하지 않습니다. 설정에서 ${this.provider} 키를 확인해 주세요.`;
    }
    if (this.statusCode === 429) {
      return `${this.provider} API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.`;
    }
    if (this.statusCode === 529 || this.statusCode === 503) {
      return `${this.provider} 서버가 과부하 상태입니다. 잠시 후 다시 시도해 주세요.`;
    }
    if (this.statusCode === 400) {
      return `요청에 문제가 있습니다. 입력 내용을 확인해 주세요.`;
    }
    return this.message;
  }
}
