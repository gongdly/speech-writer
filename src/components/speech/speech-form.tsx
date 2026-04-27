"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles, Info, ChevronDown, ChevronUp, Plus, X, AlertCircle } from "lucide-react";
import { useLLMSettings } from "@/lib/hooks/use-llm-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { EVENT_TYPES } from "@/lib/data/event-types";
import { LENGTH_OPTIONS, estimateSpokenMinutes } from "@/lib/data/length-options";
import { AUDIENCE_OPTIONS } from "@/lib/data/audiences";
import { SPEAKER_PERSONAS, SPEAKER_PERSONA_MAP } from "@/lib/data/speaker-personas";
import type { ExtractedEventInfo } from "@/components/upload/upload-area";
import {
  speechFormSchema,
  type SpeechFormValues,
  DEFAULT_SPEECH_FORM_VALUES,
} from "@/lib/schemas/speech-form";

interface SpeechFormProps {
  sessionId?: string;
  extractedInfo?: ExtractedEventInfo | null;
  reuseValues?: Record<string, unknown> | null;
}

export function SpeechForm({ sessionId, extractedInfo, reuseValues }: SpeechFormProps = {}) {
  const router = useRouter();
  const { getAuthPayload, hasAnyKey, settings } = useLLMSettings();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<SpeechFormValues>({
    resolver: zodResolver(speechFormSchema),
    mode: "onChange",
    defaultValues: DEFAULT_SPEECH_FORM_VALUES as SpeechFormValues,
  });

  // 행사계획서에서 추출된 정보가 들어오면 폼에 자동 채우기
  useEffect(() => {
    if (!extractedInfo) return;

    if (extractedInfo.eventName) setValue("eventName", extractedInfo.eventName);
    if (extractedInfo.eventDate) setValue("eventDate", extractedInfo.eventDate);
    if (extractedInfo.eventLocation) setValue("eventLocation", extractedInfo.eventLocation);
    if (extractedInfo.speakerRole) {
      setValue("speakerRole", extractedInfo.speakerRole as SpeechFormValues["speakerRole"]);
    }
    if (extractedInfo.speakerOrganization) {
      setValue("speakerOrganization", extractedInfo.speakerOrganization);
    }
    if (extractedInfo.keyMessages && extractedInfo.keyMessages.length > 0) {
      setValue("keyMessages", extractedInfo.keyMessages.slice(0, 3));
      setAdvancedOpen(true);
    }
    if (extractedInfo.citedStats) {
      setValue("citedStats", extractedInfo.citedStats);
      setAdvancedOpen(true);
    }
    if (extractedInfo.attendees && extractedInfo.attendees.length > 0) {
      setValue("attendees", extractedInfo.attendees.slice(0, 10));
      setAdvancedOpen(true);
    }
  }, [extractedInfo, setValue]);

  // 재사용 데이터가 들어오면 모든 필드 한 번에 채움
  useEffect(() => {
    if (!reuseValues) return;

    const fields: Array<keyof SpeechFormValues> = [
      "eventName",
      "eventDate",
      "eventLocation",
      "eventType",
      "speakerRole",
      "speakerOrganization",
      "audience",
      "lengthOption",
      "customChars",
      "keyMessages",
      "citedStats",
      "avoidExpressions",
      "attendees",
    ];

    for (const field of fields) {
      const v = reuseValues[field];
      if (v !== undefined && v !== null && v !== "") {
        setValue(field, v as never);
      }
    }

    // 고급 옵션이 채워져 있으면 펼치기
    const hasAdvanced =
      (reuseValues.keyMessages as string[])?.length > 0 ||
      reuseValues.citedStats ||
      (reuseValues.avoidExpressions as string[])?.length > 0 ||
      (reuseValues.attendees as unknown[])?.length > 0;
    if (hasAdvanced) setAdvancedOpen(true);
  }, [reuseValues, setValue]);

  const watchSpeakerRole = watch("speakerRole");
  const watchLengthOption = watch("lengthOption");
  const watchCustomChars = watch("customChars");
  const watchAudience = watch("audience") || [];
  const watchKeyMessages = watch("keyMessages") || [];
  const watchAvoidExpressions = watch("avoidExpressions") || [];

  const persona =
    watchSpeakerRole && watchSpeakerRole !== "custom" ? SPEAKER_PERSONA_MAP[watchSpeakerRole] : null;

  const onSubmit = async (data: SpeechFormValues) => {
    setSubmitting(true);
    setGenerationError(null);

    try {
      // 세션 확인
      if (!sessionId) {
        setGenerationError("세션이 발급되지 않았습니다. 페이지를 새로고침해 주세요.");
        return;
      }

      // API 키 확인
      const auth = getAuthPayload();
      if (!auth) {
        setGenerationError(
          "API 키가 설정되지 않았습니다. 우측 상단의 [API 키 설정]에서 키를 등록해 주세요.",
        );
        return;
      }

      // 분량 → targetChars 변환 (1분당 280자 기준)
      const targetChars =
        data.lengthOption === "custom"
          ? (data.customChars ?? 1400)
          : (() => {
              const opt = LENGTH_OPTIONS.find((o) => o.key === data.lengthOption);
              return opt?.targetChars ?? 1400;
            })();

      // 분량 라벨
      const lengthLabel =
        data.lengthOption === "custom"
          ? `${targetChars}자 (직접 입력)`
          : (LENGTH_OPTIONS.find((o) => o.key === data.lengthOption)?.label ??
            data.lengthOption);

      // 행사 유형 라벨
      const eventTypeLabel = EVENT_TYPES.find((e) => e.key === data.eventType)?.label;

      // 발화자 직급 라벨
      const speakerRoleLabel = SPEAKER_PERSONAS.find(
        (p) => p.key === data.speakerRole,
      )?.label;

      // generate-speech API 호출
      const res = await fetch("/api/generate-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          provider: auth.provider,
          model: auth.model,
          apiKey: auth.apiKey,
          // RAG 임베딩용 Gemini 키 (등록된 경우만, 없으면 서버 키 fallback)
          userGeminiKey: settings.keys.gemini || undefined,
          useRag: true,
          formData: {
            eventName: data.eventName,
            eventDate: data.eventDate || undefined,
            eventLocation: data.eventLocation || undefined,
            eventType: data.eventType,
            eventTypeLabel,
            speakerRole: data.speakerRole,
            speakerRoleLabel,
            speakerRoleCustom: data.speakerRoleCustom || undefined,
            speakerOrganization: data.speakerOrganization || undefined,
            audience: data.audience,
            lengthOption: lengthLabel,
            targetChars,
            keyMessages: (data.keyMessages || []).filter(Boolean),
            citedStats: data.citedStats || undefined,
            avoidExpressions: (data.avoidExpressions || []).filter(Boolean),
            attendees: (data.attendees || []).filter((a) => a.name && a.role),
          },
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setGenerationError(result.error ?? `생성 실패 (HTTP ${res.status})`);
        return;
      }

      // 결과 페이지로 이동
      router.push(`/result/${result.draftId}`);
    } catch (e) {
      setGenerationError(e instanceof Error ? e.message : "예기치 않은 오류");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 행사 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">행사 정보</CardTitle>
          <CardDescription>행사명·일시·장소를 입력하세요. 행사계획서가 있으면 자동 추출도 가능합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eventName">
              행사명 <span className="text-destructive">*</span>
            </Label>
            <Input id="eventName" placeholder="예: 「2026 전자정부의 날 기념식」" {...register("eventName")} />
            {errors.eventName && (
              <p className="text-sm text-destructive">{errors.eventName.message}</p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventDate">일시</Label>
              <Input id="eventDate" type="datetime-local" {...register("eventDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventLocation">장소</Label>
              <Input id="eventLocation" placeholder="예: 정부세종컨벤션센터 대회의실" {...register("eventLocation")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 발화자 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">발화자</CardTitle>
          <CardDescription>직급·소속 기관을 입력하세요. 직급에 따라 페르소나가 자동 적용됩니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                직급 <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="speakerRole"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="직급을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPEAKER_PERSONAS.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="speakerOrganization">소속 (선택)</Label>
              <Input
                id="speakerOrganization"
                placeholder="예: 행정안전부, ○○시청, ○○공사"
                {...register("speakerOrganization")}
              />
            </div>
          </div>

          {watchSpeakerRole === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="speakerRoleCustom">
                직급명 직접 입력 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="speakerRoleCustom"
                placeholder="예: 차장, 단장, 위원장 등"
                {...register("speakerRoleCustom")}
              />
              {errors.speakerRoleCustom && (
                <p className="text-sm text-destructive">{errors.speakerRoleCustom.message}</p>
              )}
            </div>
          )}

          {persona && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">자동 적용 페르소나: {persona.label}</p>
                  <p className="text-muted-foreground">{persona.description}</p>
                  <p className="text-muted-foreground">
                    톤: {persona.tone} · 격식 {persona.formalityLevel}/5 · 한자어{" "}
                    {Math.round(persona.hanjaRatioTarget * 100)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 행사 유형 + 청중 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">행사 유형 · 청중</CardTitle>
          <CardDescription>유형과 청중에 따라 구조와 톤이 자동 조정됩니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>
              행사 유형 <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="eventType"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="행사 유형을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.label} — {t.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>
              청중 <span className="text-destructive">*</span>{" "}
              <span className="text-xs text-muted-foreground">(다중 선택, 최대 5개)</span>
            </Label>
            <Controller
              name="audience"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AUDIENCE_OPTIONS.map((a) => {
                    const checked = field.value?.includes(a.key);
                    return (
                      <label
                        key={a.key}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors",
                          checked ? "border-primary bg-primary/5" : "hover:bg-accent",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            const cur = field.value || [];
                            if (c) {
                              if (cur.length < 5) field.onChange([...cur, a.key]);
                            } else {
                              field.onChange(cur.filter((v) => v !== a.key));
                            }
                          }}
                        />
                        <span>{a.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.audience && (
              <p className="text-sm text-destructive">{errors.audience.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 분량 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">분량</CardTitle>
          <CardDescription>발화 시간 또는 글자수를 선택하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Controller
            name="lengthOption"
            control={control}
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-2">
                {LENGTH_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className={cn(
                      "flex items-center gap-3 rounded-md border px-4 py-3 cursor-pointer transition-colors",
                      field.value === opt.key ? "border-primary bg-primary/5" : "hover:bg-accent",
                    )}
                  >
                    <RadioGroupItem value={opt.key} />
                    <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{opt.label}</span>
                        {opt.isDefault && (
                          <span className="ml-2 text-xs text-primary">[기본값]</span>
                        )}
                        <span className="ml-2 text-xs text-muted-foreground">{opt.useCase}</span>
                      </div>
                      {!opt.isCustom && (
                        <span className="text-sm text-muted-foreground">
                          ~{opt.targetChars.toLocaleString()}자 / {opt.spokenMinutes}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
          />

          {watchLengthOption === "custom" && (
            <div className="space-y-2 pl-7">
              <Label htmlFor="customChars">
                글자수 직접 입력 <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="customChars"
                  type="number"
                  min={300}
                  max={5000}
                  step={100}
                  placeholder="300~5,000"
                  className="max-w-[160px]"
                  {...register("customChars")}
                />
                <span className="text-sm text-muted-foreground">자</span>
                {watchCustomChars && watchCustomChars >= 300 && (
                  <span className="text-sm text-muted-foreground">
                    · 발화 시간 {estimateSpokenMinutes(Number(watchCustomChars))}
                  </span>
                )}
              </div>
              {errors.customChars && (
                <p className="text-sm text-destructive">{errors.customChars.message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 고급 옵션 */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">고급 옵션</CardTitle>
              <CardDescription>핵심 메시지·인용 통계·피해야 할 표현 등을 지정합니다.</CardDescription>
            </div>
            {advancedOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </CardHeader>
        {advancedOpen && (
          <CardContent className="space-y-6">
            {/* 핵심 메시지 */}
            <TagInput
              label="핵심 메시지"
              hint="최대 3개. 본문 4단(정책 사례)에서 강조할 메시지."
              max={3}
              values={watchKeyMessages}
              onAdd={(v) => setValue("keyMessages", [...watchKeyMessages, v])}
              onRemove={(i) =>
                setValue(
                  "keyMessages",
                  watchKeyMessages.filter((_, idx) => idx !== i),
                )
              }
              placeholder="예: 디지털 격차 해소"
            />

            {/* 인용 통계·일화 */}
            <div className="space-y-2">
              <Label htmlFor="citedStats">인용 통계·일화</Label>
              <Textarea
                id="citedStats"
                placeholder="예: 지난해 디지털 행정서비스 이용자 1,200만 명 돌파"
                rows={3}
                maxLength={500}
                {...register("citedStats")}
              />
              <p className="text-xs text-muted-foreground">참고자료 업로드 시 자동 추출됩니다 (최대 500자)</p>
            </div>

            {/* 피해야 할 표현 */}
            <TagInput
              label="피해야 할 표현"
              hint="최대 5개. AI가 사용을 회피합니다."
              max={5}
              values={watchAvoidExpressions}
              onAdd={(v) => setValue("avoidExpressions", [...watchAvoidExpressions, v])}
              onRemove={(i) =>
                setValue(
                  "avoidExpressions",
                  watchAvoidExpressions.filter((_, idx) => idx !== i),
                )
              }
              placeholder="예: 절체절명, 미증유"
            />
          </CardContent>
        )}
      </Card>

      {/* 제출 */}
      <div className="sticky bottom-4 bg-background/80 backdrop-blur-sm border rounded-lg p-4 shadow-lg space-y-3">
        {!hasAnyKey && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              API 키가 설정되지 않았습니다. 우측 상단의{" "}
              <a href="/settings" className="underline font-medium">
                [API 키 설정]
              </a>
              에서 키를 등록해 주세요.
            </div>
          </div>
        )}

        {generationError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>{generationError}</div>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!isValid || submitting || !hasAnyKey}
        >
          <Sparkles className="mr-2 w-5 h-5" />
          {submitting ? "생성 중... (최대 60초 소요)" : "AI 초안 생성"}
        </Button>
      </div>
    </form>
  );
}

/**
 * 태그 입력 컴포넌트 (핵심 메시지·피해야 할 표현 공용)
 */
function TagInput({
  label,
  hint,
  max,
  values,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  hint: string;
  max: number;
  values: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const v = input.trim();
    if (!v || values.length >= max) return;
    onAdd(v);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <Label>
        {label} <span className="text-xs text-muted-foreground">({values.length}/{max})</span>
      </Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          disabled={values.length >= max}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          disabled={!input.trim() || values.length >= max}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm"
            >
              {v}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="hover:text-destructive"
                aria-label="삭제"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
