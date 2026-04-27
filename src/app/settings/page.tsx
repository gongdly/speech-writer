"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Trash2,
  X,
  Info,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  PROVIDER_KEY_PLACEHOLDERS,
  PROVIDER_KEY_PREFIX,
  DEFAULT_LLM_SETTINGS,
  type LLMProvider,
  type UserLLMSettings,
} from "@/lib/llm/types";
import {
  loadSettings,
  saveProviderKey,
  saveProviderModel,
  setDefaultProvider,
  removeProviderKey,
  maskKey,
  getAvailableProviders,
} from "@/lib/llm/storage";

type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

interface ValidationResult {
  status: ValidationStatus;
  message?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] =
    useState<UserLLMSettings>(DEFAULT_LLM_SETTINGS);
  const [mounted, setMounted] = useState(false);

  // provider별 입력 상태
  const [keyInputs, setKeyInputs] = useState<
    Record<LLMProvider, string>
  >({
    anthropic: "",
    gemini: "",
    openai: "",
  });

  const [showKey, setShowKey] = useState<Record<LLMProvider, boolean>>({
    anthropic: false,
    gemini: false,
    openai: false,
  });

  const [validation, setValidation] = useState<
    Record<LLMProvider, ValidationResult>
  >({
    anthropic: { status: "idle" },
    gemini: { status: "idle" },
    openai: { status: "idle" },
  });

  // 마운트 시 localStorage에서 설정 로드
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const providers: LLMProvider[] = ["anthropic", "gemini", "openai"];
  const availableProviders = getAvailableProviders(settings);

  const handleValidateAndSave = async (provider: LLMProvider) => {
    const apiKey = keyInputs[provider];

    if (!apiKey) {
      setValidation((prev) => ({
        ...prev,
        [provider]: {
          status: "invalid",
          message: "API 키를 입력해 주세요",
        },
      }));
      return;
    }

    // 형식 검증 (prefix 확인)
    const prefix = PROVIDER_KEY_PREFIX[provider];
    if (!apiKey.startsWith(prefix)) {
      setValidation((prev) => ({
        ...prev,
        [provider]: {
          status: "invalid",
          message: `${PROVIDER_LABELS[provider]} 키는 "${prefix}"로 시작합니다`,
        },
      }));
      return;
    }

    setValidation((prev) => ({
      ...prev,
      [provider]: { status: "validating" },
    }));

    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = (await res.json()) as {
        valid: boolean;
        error?: string;
      };

      if (data.valid) {
        // 유효하면 저장
        const newSettings = saveProviderKey(provider, apiKey);
        setSettings(newSettings);
        setKeyInputs((prev) => ({ ...prev, [provider]: "" }));
        setValidation((prev) => ({
          ...prev,
          [provider]: {
            status: "valid",
            message: "검증·저장 완료",
          },
        }));

        // 3초 후 idle 상태로
        setTimeout(() => {
          setValidation((prev) => ({
            ...prev,
            [provider]: { status: "idle" },
          }));
        }, 3000);
      } else {
        setValidation((prev) => ({
          ...prev,
          [provider]: {
            status: "invalid",
            message: data.error ?? "검증 실패",
          },
        }));
      }
    } catch (e) {
      setValidation((prev) => ({
        ...prev,
        [provider]: {
          status: "invalid",
          message:
            e instanceof Error ? e.message : "네트워크 오류",
        },
      }));
    }
  };

  const handleRemoveKey = (provider: LLMProvider) => {
    if (!confirm(`${PROVIDER_LABELS[provider]} 키를 삭제하시겠습니까?`)) {
      return;
    }
    const newSettings = removeProviderKey(provider);
    setSettings(newSettings);
    setValidation((prev) => ({
      ...prev,
      [provider]: { status: "idle" },
    }));
  };

  const handleModelChange = (provider: LLMProvider, model: string) => {
    const newSettings = saveProviderModel(provider, model);
    setSettings(newSettings);
  };

  const handleDefaultProviderChange = (provider: LLMProvider) => {
    const newSettings = setDefaultProvider(provider);
    setSettings(newSettings);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-3xl py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4 -ml-2">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              홈으로
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">API 키 설정</h1>
              <p className="text-sm text-muted-foreground">
                사용하실 AI 모델의 API 키를 입력해 주세요
              </p>
            </div>
          </div>
        </div>

        {/* 안내 박스 */}
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-blue-900">
                  보안 안내
                </p>
                <ul className="space-y-1 text-blue-800">
                  <li>· 입력하신 API 키는 본인 브라우저에만 저장됩니다</li>
                  <li>· 서버에 저장되지 않으며 다른 사용자와 공유되지 않습니다</li>
                  <li>· 검증 시에만 일회성으로 서버를 거쳐 각 AI 회사로 전송됩니다</li>
                  <li>· 사용한 만큼 본인 계정에 요금이 청구됩니다</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 기본 모델 선택 */}
        {availableProviders.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                기본 사용 모델
              </CardTitle>
              <CardDescription>
                말씀자료 작성 시 기본으로 사용할 AI를 선택합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={settings.defaultProvider}
                onValueChange={(v) =>
                  handleDefaultProviderChange(v as LLMProvider)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Provider별 키 입력 카드 */}
        <div className="space-y-4">
          {providers.map((provider) => {
            const hasKey = !!settings.keys[provider];
            const validationResult = validation[provider];
            const currentModel =
              settings.models[provider] ??
              PROVIDER_MODELS[provider][0].id;
            const isInputting = keyInputs[provider].length > 0;

            return (
              <Card key={provider}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {PROVIDER_LABELS[provider]}
                    </CardTitle>
                    {hasKey ? (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800 inline-flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        설정됨
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        미설정
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 현재 저장된 키 표시 */}
                  {hasKey && (
                    <div className="p-3 rounded-md bg-muted/50 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs text-muted-foreground">
                          저장된 키
                        </Label>
                        <p className="text-sm font-mono">
                          {maskKey(settings.keys[provider]!)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveKey(provider)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        삭제
                      </Button>
                    </div>
                  )}

                  {/* 키 입력 영역 */}
                  <div className="space-y-2">
                    <Label htmlFor={`key-${provider}`}>
                      {hasKey ? "키 변경" : "API 키 입력"}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={`key-${provider}`}
                          type={showKey[provider] ? "text" : "password"}
                          placeholder={
                            PROVIDER_KEY_PLACEHOLDERS[provider]
                          }
                          value={keyInputs[provider]}
                          onChange={(e) =>
                            setKeyInputs((prev) => ({
                              ...prev,
                              [provider]: e.target.value,
                            }))
                          }
                          className="font-mono text-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowKey((prev) => ({
                              ...prev,
                              [provider]: !prev[provider],
                            }))
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={
                            showKey[provider] ? "숨기기" : "보기"
                          }
                        >
                          {showKey[provider] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <Button
                        onClick={() => handleValidateAndSave(provider)}
                        disabled={
                          !isInputting ||
                          validationResult.status === "validating"
                        }
                      >
                        {validationResult.status === "validating" ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            검증 중
                          </>
                        ) : (
                          "검증 후 저장"
                        )}
                      </Button>
                    </div>

                    {/* 검증 결과 메시지 */}
                    {validationResult.message && (
                      <p
                        className={`text-xs flex items-center gap-1 ${
                          validationResult.status === "valid"
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {validationResult.status === "valid" ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        {validationResult.message}
                      </p>
                    )}
                  </div>

                  {/* 모델 선택 */}
                  {hasKey && (
                    <div className="space-y-2">
                      <Label htmlFor={`model-${provider}`}>
                        사용 모델
                      </Label>
                      <Select
                        value={currentModel}
                        onValueChange={(v) => handleModelChange(provider, v)}
                      >
                        <SelectTrigger id={`model-${provider}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDER_MODELS[provider].map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              <div>
                                <div className="font-medium">{m.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {m.description}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 키 발급 안내 */}
                  {!hasKey && (
                    <div className="text-xs text-muted-foreground">
                      <KeyIssueHint provider={provider} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 하단 액션 */}
        <div className="mt-8 flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {availableProviders.length === 0
              ? "최소 1개 이상의 키를 설정해 주세요"
              : `${availableProviders.length}개 모델 사용 가능`}
          </p>
          <Button asChild>
            <Link href="/speech">말씀자료 작성하러 가기</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

function KeyIssueHint({ provider }: { provider: LLMProvider }) {
  const links: Record<LLMProvider, { url: string; label: string }> = {
    anthropic: {
      url: "https://console.anthropic.com/settings/keys",
      label: "Anthropic Console에서 발급",
    },
    gemini: {
      url: "https://aistudio.google.com/apikey",
      label: "Google AI Studio에서 발급",
    },
    openai: {
      url: "https://platform.openai.com/api-keys",
      label: "OpenAI Platform에서 발급",
    },
  };
  const link = links[provider];
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline text-primary"
    >
      → {link.label}
    </a>
  );
}
