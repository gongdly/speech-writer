"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Sparkles, Loader2 } from "lucide-react";
import { useLLMSettings } from "@/lib/hooks/use-llm-settings";

export interface PersonaFormValues {
  name: string;
  organization: string;
  role: string;
  tone: string;
  speech_style: string;
  preferred_phrases: string[];
  avoided_phrases: string[];
  preferred_topics: string[];
  custom_instructions: string;
}

export const TONE_OPTIONS = [
  { value: "formal", label: "격식 있고 권위적" },
  { value: "friendly", label: "친근하고 부드러움" },
  { value: "data_driven", label: "통계·데이터 중심" },
  { value: "visionary", label: "비전·미래 지향적" },
  { value: "mixed", label: "균형 잡힌 혼합" },
];

export const SPEECH_STYLE_OPTIONS = [
  { value: "eumsche", label: "음슴체 (~함, ~임)" },
  { value: "gyeoksik", label: "격식체 (~합니다, ~입니다)" },
  { value: "mixed", label: "혼합" },
];

export const ROLE_OPTIONS = [
  { value: "minister", label: "장관" },
  { value: "vice_minister", label: "차관" },
  { value: "director_general", label: "국장" },
  { value: "director", label: "과장" },
  { value: "head_of_org", label: "기관장" },
  { value: "custom", label: "기타" },
];

interface PersonaFormProps {
  initialValues?: Partial<PersonaFormValues>;
  onSubmit: (values: PersonaFormValues) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  showAutoExtract?: boolean; // 신규 생성 시에만 표시
}

export function PersonaForm({
  initialValues,
  onSubmit,
  onCancel,
  submitting = false,
  showAutoExtract = false,
}: PersonaFormProps) {
  const { getAuthPayload } = useLLMSettings();

  const [name, setName] = useState(initialValues?.name ?? "");
  const [organization, setOrganization] = useState(
    initialValues?.organization ?? "",
  );
  const [role, setRole] = useState(initialValues?.role ?? "");
  const [tone, setTone] = useState(initialValues?.tone ?? "formal");
  const [speechStyle, setSpeechStyle] = useState(
    initialValues?.speech_style ?? "eumsche",
  );
  const [preferredPhrases, setPreferredPhrases] = useState<string[]>(
    initialValues?.preferred_phrases ?? [],
  );
  const [avoidedPhrases, setAvoidedPhrases] = useState<string[]>(
    initialValues?.avoided_phrases ?? [],
  );
  const [preferredTopics, setPreferredTopics] = useState<string[]>(
    initialValues?.preferred_topics ?? [],
  );
  const [customInstructions, setCustomInstructions] = useState(
    initialValues?.custom_instructions ?? "",
  );

  // 입력 중인 임시 값
  const [newPhrase, setNewPhrase] = useState("");
  const [newAvoided, setNewAvoided] = useState("");
  const [newTopic, setNewTopic] = useState("");

  // 자동 도출 상태
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // initialValues 변경 시 동기화 (자동 도출 결과가 들어올 때)
  useEffect(() => {
    if (initialValues) {
      if (initialValues.name !== undefined) setName(initialValues.name);
      if (initialValues.organization !== undefined)
        setOrganization(initialValues.organization);
      if (initialValues.role !== undefined) setRole(initialValues.role);
      if (initialValues.tone !== undefined) setTone(initialValues.tone);
      if (initialValues.speech_style !== undefined)
        setSpeechStyle(initialValues.speech_style);
      if (initialValues.preferred_phrases !== undefined)
        setPreferredPhrases(initialValues.preferred_phrases);
      if (initialValues.avoided_phrases !== undefined)
        setAvoidedPhrases(initialValues.avoided_phrases);
      if (initialValues.preferred_topics !== undefined)
        setPreferredTopics(initialValues.preferred_topics);
      if (initialValues.custom_instructions !== undefined)
        setCustomInstructions(initialValues.custom_instructions);
    }
  }, [initialValues]);

  const handleAutoExtract = async () => {
    setExtractError(null);

    if (!organization && !role) {
      setExtractError("자동 도출하려면 소속 또는 직책 중 하나는 입력해 주세요");
      return;
    }

    const auth = getAuthPayload();
    if (!auth) {
      setExtractError("API 키 설정이 필요합니다 (설정 페이지)");
      return;
    }

    setExtracting(true);
    try {
      const res = await fetch("/api/personas/auto-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: auth.provider,
          model: auth.model,
          apiKey: auth.apiKey,
          organization: organization || undefined,
          role: role || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setExtractError(data.error ?? "자동 도출 실패");
        return;
      }

      // 도출 결과를 폼에 채움
      const s = data.suggested;
      if (s.name) setName(s.name);
      if (s.tone) setTone(s.tone);
      if (s.speech_style) setSpeechStyle(s.speech_style);
      if (Array.isArray(s.preferred_phrases))
        setPreferredPhrases(s.preferred_phrases);
      if (Array.isArray(s.avoided_phrases))
        setAvoidedPhrases(s.avoided_phrases);
      if (Array.isArray(s.preferred_topics))
        setPreferredTopics(s.preferred_topics);
      if (s.custom_instructions !== undefined)
        setCustomInstructions(s.custom_instructions);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "자동 도출 실패");
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSubmit({
      name: name.trim(),
      organization: organization.trim(),
      role: role.trim(),
      tone,
      speech_style: speechStyle,
      preferred_phrases: preferredPhrases.filter((s) => s.trim()),
      avoided_phrases: avoidedPhrases.filter((s) => s.trim()),
      preferred_topics: preferredTopics.filter((s) => s.trim()),
      custom_instructions: customInstructions.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 기본 정보 */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm">기본 정보</h3>

        <div className="space-y-2">
          <Label htmlFor="persona-name">
            이름·호칭 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="persona-name"
            placeholder="예: ○○ 장관님, 행정안전부 차관님"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="persona-org">소속</Label>
            <Input
              id="persona-org"
              placeholder="예: 행정안전부"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="persona-role">직책</Label>
            <select
              id="persona-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">선택 안 함</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 자동 도출 버튼 (신규 생성 시) */}
        {showAutoExtract && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900 p-3">
            <div className="flex items-start gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm flex-1">
                <p className="font-medium mb-1">과거 작성 이력에서 자동 도출</p>
                <p className="text-xs text-muted-foreground">
                  위 소속·직책으로 작성된 과거 말씀자료 3건 이상이 있으면, AI가
                  분석해 페르소나를 자동 제안합니다. 결과는 아래 필드에 채워지며
                  자유롭게 수정할 수 있습니다.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAutoExtract}
              disabled={extracting || (!organization && !role)}
            >
              {extracting ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  분석 중... (10~30초)
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-2" />
                  과거 이력 분석해서 자동 도출
                </>
              )}
            </Button>
            {extractError && (
              <p className="text-xs text-destructive mt-2">{extractError}</p>
            )}
          </div>
        )}
      </div>

      {/* 톤·어체 */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm">톤·어체</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="persona-tone">톤</Label>
            <select
              id="persona-tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="persona-style">어체</Label>
            <select
              id="persona-style"
              value={speechStyle}
              onChange={(e) => setSpeechStyle(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SPEECH_STYLE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 표현 사전 */}
      <PhraseList
        title="자주 쓰는 표현"
        description="LLM이 본문에 자연스럽게 1~3회 활용합니다."
        placeholder="예: 한 마디로, 한 번 더 강조하자면"
        items={preferredPhrases}
        setItems={setPreferredPhrases}
        newItem={newPhrase}
        setNewItem={setNewPhrase}
      />

      <PhraseList
        title="피하는 표현"
        description="LLM이 본문에서 절대 사용하지 않습니다."
        placeholder="예: 인공지능 (대신 AI 사용)"
        items={avoidedPhrases}
        setItems={setAvoidedPhrases}
        newItem={newAvoided}
        setNewItem={setNewAvoided}
      />

      <PhraseList
        title="즐겨 다루는 주제·관점"
        description="가능하면 본문에 녹여 넣습니다."
        placeholder="예: 통계 인용, 시민 일상의 사례, 역사적 인물"
        items={preferredTopics}
        setItems={setPreferredTopics}
        newItem={newTopic}
        setNewItem={setNewTopic}
      />

      {/* 자유 입력 추가 지시 */}
      <div className="space-y-2">
        <Label htmlFor="persona-custom">추가 작성 지침 (선택)</Label>
        <Textarea
          id="persona-custom"
          placeholder="예: 항상 시민 관점에서 시작, 마무리는 다짐으로"
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          rows={3}
        />
      </div>

      {/* 제출 */}
      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? "저장 중..." : "저장"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}

// ============================================================
// 표현 리스트 입력 (재사용)
// ============================================================
function PhraseList({
  title,
  description,
  placeholder,
  items,
  setItems,
  newItem,
  setNewItem,
}: {
  title: string;
  description: string;
  placeholder: string;
  items: string[];
  setItems: (items: string[]) => void;
  newItem: string;
  setNewItem: (s: string) => void;
}) {
  const handleAdd = () => {
    if (newItem.trim() && !items.includes(newItem.trim())) {
      setItems([...items, newItem.trim()]);
      setNewItem("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <Label>{title}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-sm"
          >
            <span>{item}</span>
            <button
              type="button"
              onClick={() => setItems(items.filter((_, i) => i !== idx))}
              className="text-muted-foreground hover:text-destructive"
              aria-label="삭제"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button type="button" size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
