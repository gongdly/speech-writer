"use client";

import { useEffect, useMemo, useState } from "react";
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
 *
 * effectiveProvider: defaultProvider에 키가 없을 경우
 * 실제 등록된 provider로 자동 fallback.
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

  const availableProviders = useMemo(
    () => getAvailableProviders(settings),
    [settings],
  );

  /**
   * 실제 사용될 provider 결정
   * - defaultProvider에 키가 있으면 그대로 사용
   * - 키가 없으면 등록된 첫 번째 provider 사용
   * - 아무것도 없으면 null
   */
  const effectiveProvider = useMemo<LLMProvider | null>(() => {
    if (settings.keys[settings.defaultProvider]) {
      return settings.defaultProvider;
    }
    return availableProviders[0] ?? null;
  }, [settings, availableProviders]);

  return {
    settings,
    loaded,
    hasAnyKey: hasAnyKey(settings),
    availableProviders,
    effectiveProvider,
    /**
     * API 호출 시 body에 포함시킬 인증 정보
     * - overrideProvider 지정 시 그것 사용
     * - 미지정 시 effectiveProvider 사용 (defaultProvider 키 없으면 자동 fallback)
     */
    getAuthPayload: (overrideProvider?: LLMProvider) => {
      const provider = overrideProvider ?? effectiveProvider;
      if (!provider) return null;

      const apiKey = settings.keys[provider];
      const model = settings.models[provider];

      if (!apiKey || !model) {
        return null;
      }

      return { provider, model, apiKey };
    },
  };
}
