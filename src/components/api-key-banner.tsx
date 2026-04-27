"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLLMSettings } from "@/lib/hooks/use-llm-settings";
import { PROVIDER_LABELS } from "@/lib/llm/types";

/**
 * API 키 설정 상태를 보여주는 배너
 *
 * 미설정 시: 빨간 배너 + 설정 페이지로 이동 버튼
 * 설정됨: 작은 회색 배너 + 실제 사용될 모델 표시
 *
 * defaultProvider에 키가 없으면 effectiveProvider(자동 fallback)를 표시한다.
 */
export function ApiKeyBanner() {
  const { settings, loaded, hasAnyKey, effectiveProvider } = useLLMSettings();

  if (!loaded) return null;

  if (!hasAnyKey || !effectiveProvider) {
    return (
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-amber-900">
              API 키가 설정되지 않았습니다
            </p>
            <p className="text-sm text-amber-800 mt-1">
              말씀자료를 작성하려면 먼저 Claude / Gemini / GPT 중 하나 이상의
              API 키를 등록해 주세요.
            </p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/settings">
                <KeyRound className="w-4 h-4 mr-1" />
                설정 페이지로 이동
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentModel = settings.models[effectiveProvider];
  const isFallback = effectiveProvider !== settings.defaultProvider;

  return (
    <div className="mb-6 rounded-md bg-muted/50 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-muted-foreground">사용 모델:</span>
        <span className="font-medium">{PROVIDER_LABELS[effectiveProvider]}</span>
        {currentModel && (
          <span className="text-xs text-muted-foreground font-mono">
            ({currentModel})
          </span>
        )}
        {isFallback && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            기본 설정({PROVIDER_LABELS[settings.defaultProvider]}) 키 없음 → 자동 전환
          </span>
        )}
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <KeyRound className="w-3.5 h-3.5 mr-1" />
          변경
        </Link>
      </Button>
    </div>
  );
}
