"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Users,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  PersonaForm,
  type PersonaFormValues,
  TONE_OPTIONS,
  SPEECH_STYLE_OPTIONS,
  ROLE_OPTIONS,
} from "@/components/personas/persona-form";

interface Persona {
  id: string;
  name: string;
  organization: string | null;
  role: string | null;
  tone: string;
  speech_style: string;
  preferred_phrases: string[];
  avoided_phrases: string[];
  preferred_topics: string[];
  custom_instructions: string | null;
  is_active: boolean;
  source: string;
  use_count: number;
  last_used_at: number | null;
  created_at: number;
  updated_at: number;
}

type Mode = "list" | "create" | "edit";

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("list");
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadPersonas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/personas");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "조회 실패");
      setPersonas(data.personas ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersonas();
  }, []);

  const handleCreate = async (values: PersonaFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");

      setSuccessMsg(`"${values.name}" 페르소나가 생성되었습니다.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setMode("list");
      await loadPersonas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (values: PersonaFormValues) => {
    if (!editingPersona) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/personas/${editingPersona.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "수정 실패");

      setSuccessMsg(`"${values.name}" 페르소나가 수정되었습니다.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setMode("list");
      setEditingPersona(null);
      await loadPersonas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (persona: Persona) => {
    if (!confirm(`"${persona.name}" 페르소나를 정말 삭제하시겠습니까?`))
      return;

    try {
      const res = await fetch(`/api/personas/${persona.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");

      setSuccessMsg(`"${persona.name}" 삭제 완료`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadPersonas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  // 폼 모드
  if (mode === "create" || mode === "edit") {
    const initialValues: Partial<PersonaFormValues> | undefined =
      mode === "edit" && editingPersona
        ? {
            name: editingPersona.name,
            organization: editingPersona.organization ?? "",
            role: editingPersona.role ?? "",
            tone: editingPersona.tone,
            speech_style: editingPersona.speech_style,
            preferred_phrases: editingPersona.preferred_phrases,
            avoided_phrases: editingPersona.avoided_phrases,
            preferred_topics: editingPersona.preferred_topics,
            custom_instructions: editingPersona.custom_instructions ?? "",
          }
        : undefined;

    return (
      <div className="container mx-auto max-w-3xl p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMode("list");
              setEditingPersona(null);
              setError(null);
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <h1 className="text-xl font-bold">
            {mode === "create" ? "새 페르소나" : "페르소나 편집"}
          </h1>
          <div />
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <PersonaForm
              initialValues={initialValues}
              onSubmit={mode === "create" ? handleCreate : handleEdit}
              onCancel={() => {
                setMode("list");
                setEditingPersona(null);
                setError(null);
              }}
              submitting={submitting}
              showAutoExtract={mode === "create"}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // 목록 모드
  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />홈
          </Button>
        </Link>
        <h1 className="text-xl font-bold">발화자 페르소나 관리</h1>
        <div />
      </div>

      <div className="rounded-lg border border-border/50 bg-blue-50/40 dark:bg-blue-950/10 p-4 mb-6 text-sm">
        <div className="flex items-start gap-2">
          <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-1">발화자 페르소나</p>
            <p className="text-muted-foreground">
              장관·차관·국장 등 같은 발화자의 말씀자료를 반복 작성하실 때, 그
              발화자 특유의 말투·자주 쓰는 표현·즐겨 다루는 주제를 저장해
              일관성 있게 작성합니다. 작성 폼에서 페르소나를 선택하면 자동
              적용됩니다.
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-6">
        <Button
          onClick={() => {
            setMode("create");
            setError(null);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />새 페르소나
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : personas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="mb-2">아직 저장된 페르소나가 없습니다.</p>
            <p className="text-xs">
              "새 페르소나" 버튼을 눌러 만들거나, 과거 작성 이력에서 자동으로
              도출할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {personas.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      <span>{p.name}</span>
                      {p.source === "auto_extracted" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1 font-normal">
                          <Sparkles className="w-2.5 h-2.5" />
                          자동 도출
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {[
                        p.organization,
                        ROLE_OPTIONS.find((r) => r.value === p.role)?.label ??
                          p.role,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {p.use_count > 0 && (
                        <>
                          {" · "}
                          사용 {p.use_count}회
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingPersona(p);
                        setMode("edit");
                        setError(null);
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(p)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-1 pt-0">
                <div>
                  <span className="text-muted-foreground">톤·어체: </span>
                  {TONE_OPTIONS.find((t) => t.value === p.tone)?.label ??
                    p.tone}{" "}
                  ·{" "}
                  {SPEECH_STYLE_OPTIONS.find(
                    (s) => s.value === p.speech_style,
                  )?.label ?? p.speech_style}
                </div>
                {p.preferred_phrases.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">선호 표현: </span>
                    {p.preferred_phrases.slice(0, 3).join(", ")}
                    {p.preferred_phrases.length > 3 && ` 외 ${p.preferred_phrases.length - 3}개`}
                  </div>
                )}
                {p.preferred_topics.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">선호 주제: </span>
                    {p.preferred_topics.slice(0, 3).join(", ")}
                    {p.preferred_topics.length > 3 && ` 외 ${p.preferred_topics.length - 3}개`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
