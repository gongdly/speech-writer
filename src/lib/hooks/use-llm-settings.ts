"use client";

import { useEffect, useState } from "react";
import {
  loadSettings,
  hasAnyKey,
  getAvailableProviders,
} from "@/lib/llm/storage";
import {
  DEFAULT_LLM_SETTINGS,
  type LLMProvider,
  type UserLLMSettings,
} from "@/lib/llm/types";

/**
 * 클라이언트 컴포넌트에서 LLM 설정을 사용하기 위한 React 훅
 *
 * SSR-safe: 서버 렌더링 시에는 기본값을 반환하고
 * 마운트 후 localStorage에서 실제 값을 로드한다.
 */
export function useLLMSettings() {
  const [settings, setSettings] = useState<UserLLMSettings>(
    DEFAULT_LLM_SETTINGS,
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);

    // 다른 탭에서 변경 시 동기화
    const handler = (e: StorageEvent) => {
      if (e.key && e.key.includes("anthropic_api_key_settings")) {
        setSettings(loadSettings());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return {
    settings,
    loaded,
    hasAnyKey: hasAnyKey(settings),
    availableProviders: getAvailableProviders(settings),
    /**
     * API 호출 시 body에 포함시킬 인증 정보
     * 사용자가 선택한 기본 provider 기준으로 반환
     */
    getAuthPayload: (overrideProvider?: LLMProvider) => {
      const provider = overrideProvider ?? settings.defaultProvider;
      const apiKey = settings.keys[provider];
      const model = settings.models[provider];

      if (!apiKey || !model) {
        return null;
      }

      return { provider, model, apiKey };
    },
  };
}
