/**
 * 사용자 LLM 설정 저장·조회 헬퍼 (브라우저 전용)
 *
 * localStorage에 API 키와 모델 선택을 저장한다.
 * 키는 사용자 본인 브라우저에만 존재하며 서버에는 저장되지 않는다.
 */

"use client";

import {
  DEFAULT_LLM_SETTINGS,
  LLM_SETTINGS_STORAGE_KEY,
  type UserLLMSettings,
  type LLMProvider,
} from "./types";

/**
 * 저장된 설정 불러오기
 * SSR 환경에서는 기본값을 반환한다.
 */
export function loadSettings(): UserLLMSettings {
  if (typeof window === "undefined") {
    return DEFAULT_LLM_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(LLM_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_LLM_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<UserLLMSettings>;

    return {
      keys: parsed.keys ?? {},
      models: { ...DEFAULT_LLM_SETTINGS.models, ...(parsed.models ?? {}) },
      defaultProvider:
        parsed.defaultProvider ?? DEFAULT_LLM_SETTINGS.defaultProvider,
    };
  } catch {
    return DEFAULT_LLM_SETTINGS;
  }
}

/**
 * 설정 저장
 */
export function saveSettings(settings: UserLLMSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    LLM_SETTINGS_STORAGE_KEY,
    JSON.stringify(settings),
  );
}

/**
 * 특정 provider의 키 저장
 */
export function saveProviderKey(
  provider: LLMProvider,
  apiKey: string,
): UserLLMSettings {
  const settings = loadSettings();
  settings.keys = { ...settings.keys, [provider]: apiKey };
  saveSettings(settings);
  return settings;
}

/**
 * 특정 provider의 키 삭제
 */
export function removeProviderKey(provider: LLMProvider): UserLLMSettings {
  const settings = loadSettings();
  const newKeys = { ...settings.keys };
  delete newKeys[provider];
  settings.keys = newKeys;
  saveSettings(settings);
  return settings;
}

/**
 * 특정 provider의 모델 저장
 */
export function saveProviderModel(
  provider: LLMProvider,
  model: string,
): UserLLMSettings {
  const settings = loadSettings();
  settings.models = { ...settings.models, [provider]: model };
  saveSettings(settings);
  return settings;
}

/**
 * 기본 provider 변경
 */
export function setDefaultProvider(provider: LLMProvider): UserLLMSettings {
  const settings = loadSettings();
  settings.defaultProvider = provider;
  saveSettings(settings);
  return settings;
}

/**
 * 키 마스킹 (UI 표시용)
 *
 * 예: "sk-ant-abc...xyz" 형태로 변환
 */
export function maskKey(apiKey: string): string {
  if (apiKey.length < 12) {
    return "••••••••";
  }
  const prefix = apiKey.slice(0, 7);
  const suffix = apiKey.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * 사용 가능한 provider 목록 (키가 입력된 것만)
 */
export function getAvailableProviders(
  settings: UserLLMSettings,
): LLMProvider[] {
  return (Object.keys(settings.keys) as LLMProvider[]).filter(
    (p) => settings.keys[p] && settings.keys[p]!.length > 0,
  );
}

/**
 * 키가 하나라도 설정되어 있는지 확인
 */
export function hasAnyKey(settings: UserLLMSettings): boolean {
  return getAvailableProviders(settings).length > 0;
}
