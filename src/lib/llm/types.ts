/**
 * LLM Provider 통합 타입 정의
 *
 * 3종 provider(Anthropic / Gemini / OpenAI)를 공통 인터페이스로 추상화.
 * 각 provider별 API 호출·응답 파싱 차이를 흡수한다.
 */

export type LLMProvider = "anthropic" | "gemini" | "openai";

export interface LLMModel {
  id: string;
  name: string;
  description: string;
}

export const PROVIDER_MODELS: Record<LLMProvider, LLMModel[]> = {
  anthropic: [
    {
      id: "claude-sonnet-4-5",
      name: "Claude Sonnet 4.6",
      description: "균형형 - 일반 작업 권장",
    },
    {
      id: "claude-opus-4-5",
      name: "Claude Opus 4.7",
      description: "정밀형 - 중요 행사 권장",
    },
  ],
  gemini: [
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      description: "균형형",
    },
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      description: "빠른 초안",
    },
  ],
  openai: [
    {
      id: "gpt-5",
      name: "GPT-5",
      description: "균형형",
    },
    {
      id: "gpt-5-mini",
      name: "GPT-5 mini",
      description: "빠른 초안",
    },
  ],
};

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  anthropic: "Anthropic Claude",
  gemini: "Google Gemini",
  openai: "OpenAI GPT",
};

export const PROVIDER_KEY_PLACEHOLDERS: Record<LLMProvider, string> = {
  anthropic: "sk-ant-...",
  gemini: "AIza...",
  openai: "sk-...",
};

export const PROVIDER_KEY_PREFIX: Record<LLMProvider, string> = {
  anthropic: "sk-ant-",
  gemini: "AIza",
  openai: "sk-",
};

/**
 * LLM 호출 요청 (provider 무관 통합 형식)
 */
export interface LLMRequest {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * LLM 호출 응답 (provider 무관 통합 형식)
 */
export interface LLMResponse {
  text: string;
  provider: LLMProvider;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

/**
 * 사용자 설정 저장 구조 (localStorage)
 */
export interface UserLLMSettings {
  keys: Partial<Record<LLMProvider, string>>;
  models: Partial<Record<LLMProvider, string>>;
  defaultProvider: LLMProvider;
}

/**
 * 기본 설정값
 */
export const DEFAULT_LLM_SETTINGS: UserLLMSettings = {
  keys: {},
  models: {
    anthropic: "claude-sonnet-4-5",
    gemini: "gemini-2.5-pro",
    openai: "gpt-5",
  },
  defaultProvider: "anthropic",
};

/**
 * localStorage 키 (추후 다른 도구와 통합 시 동일 키 사용)
 */
export const LLM_SETTINGS_STORAGE_KEY = "anthropic_api_key_settings";
