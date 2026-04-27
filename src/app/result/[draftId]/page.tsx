"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Copy,
  Edit2,
  Save,
  X,
  RefreshCw,
  Check,
  AlertCircle,
} from "lucide-react";
import { RefinePanel } from "@/components/result/refine-panel";
import { parseMarkdown, type ParsedSection } from "@/lib/utils/section-parser";

interface DraftRow {
  id: string;
  event_name: string;
  event_type: string;
  speaker_role: string;
  length_option: string;
  target_chars: number;
  draft_md: string | null;
  draft_meta: string | null;
  created_at: number;
  updated_at: number;
}

export default function ResultPage() {
  const params = useParams<{ draftId: string }>();
  const router = useRouter();

  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 편집 모드
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);

  // 복사 토스트
  const [copied, setCopied] = useState(false);

  // 단·문단 선택
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [selectedParagraph, setSelectedParagraph] = useState<number | null>(null);

  // 초안 로드
  useEffect(() => {
    if (!params.draftId) return;

    (async () => {
      try {
        const res = await fetch(`/api/drafts/${params.draftId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "조회 실패");
        setDraft(data.draft);
        setEditedContent(data.draft?.draft_md ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "조회 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.draftId]);

  const currentContent = isEditing ? editedContent : (draft?.draft_md ?? "");
  const charCount = currentContent.replace(/\s/g, "").length;
  const targetChars = draft?.target_chars ?? 0;
  const charPercent =
    targetChars > 0 ? Math.round((charCount / targetChars) * 100) : 0;

  // 단·문단 파싱
  const sections = useMemo<ParsedSection[]>(
    () => parseMarkdown(currentContent),
    [currentContent],
  );

  // 복사
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert("복사 실패. 텍스트를 직접 선택해 주세요.");
    }
  };

  // 편집 시작
  const handleStartEdit = () => {
    setEditedContent(draft?.draft_md ?? "");
    setIsEditing(true);
    setSelectedSection(null);
    setSelectedParagraph(null);
  };

  // 편집 취소
  const handleCancelEdit = () => {
    if (
      editedContent !== (draft?.draft_md ?? "") &&
      !confirm("변경 사항이 있습니다. 정말 취소하시겠습니까?")
    ) {
      return;
    }
    setEditedContent(draft?.draft_md ?? "");
    setIsEditing(false);
  };

  // 편집 저장
  const handleSaveEdit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editedContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");

      setDraft({ ...draft, draft_md: editedContent });
      setIsEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // 다시 생성 (작성 페이지로 이동)
  const handleRegenerate = () => {
    if (!confirm("새로 작성하시겠습니까? 입력 폼으로 돌아갑니다.")) return;
    router.push("/speech");
  };

  // AI로 본문 업데이트되었을 때
  const handleContentUpdated = (newContent: string) => {
    if (!draft) return;
    setDraft({ ...draft, draft_md: newContent });
    setEditedContent(newContent);
    setSelectedSection(null);
    setSelectedParagraph(null);
  };

  // 단 클릭
  const handleSectionClick = (sectionNumber: number) => {
    if (isEditing) return;
    if (selectedSection === sectionNumber && selectedParagraph === null) {
      // 같은 단 다시 클릭 → 해제
      setSelectedSection(null);
    } else {
      setSelectedSection(sectionNumber);
      setSelectedParagraph(null);
    }
  };

  // 문단 클릭
  const handleParagraphClick = (
    sectionNumber: number,
    paragraphIndex: number,
  ) => {
    if (isEditing) return;
    if (
      selectedSection === sectionNumber &&
      selectedParagraph === paragraphIndex
    ) {
      // 같은 문단 다시 클릭 → 해제
      setSelectedParagraph(null);
    } else {
      setSelectedSection(sectionNumber);
      setSelectedParagraph(paragraphIndex);
    }
  };

  const clearSelection = () => {
    setSelectedSection(null);
    setSelectedParagraph(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="text-center text-muted-foreground">
          초안을 불러오는 중...
        </div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error ?? "초안을 찾을 수 없습니다"}</span>
          </div>
        </div>
        <Link href="/speech" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            작성 페이지로
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/speech">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            작성 페이지로
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1 text-center truncate px-2">
          {draft.event_name}
        </h1>
        <Link href="/history">
          <Button variant="ghost" size="sm">
            작성 이력
          </Button>
        </Link>
      </div>

      {/* 본문 + 사이드 패널 레이아웃 */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* 메인 본문 영역 */}
        <div className="flex-1 min-w-0">
          {/* 메타 정보 */}
          <div className="mb-4 flex flex-wrap gap-4 rounded-lg border border-border/50 bg-muted/30 p-4 text-sm">
            <div>
              <span className="text-muted-foreground">분량 목표</span>{" "}
              <span className="font-medium">{draft.length_option}</span>
            </div>
            <div>
              <span className="text-muted-foreground">현재 글자수</span>{" "}
              <span
                className={`font-medium ${
                  charPercent >= 95 && charPercent <= 105
                    ? "text-emerald-600"
                    : charPercent < 95
                      ? "text-amber-600"
                      : "text-red-600"
                }`}
              >
                {charCount.toLocaleString()}자 / 목표{" "}
                {targetChars.toLocaleString()}자 ({charPercent}%)
              </span>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="mb-4 flex flex-wrap gap-2">
            {!isEditing ? (
              <>
                <Button onClick={handleStartEdit} size="sm" variant="outline">
                  <Edit2 className="mr-2 h-4 w-4" />
                  직접 편집
                </Button>
                <Button onClick={handleCopy} size="sm" variant="outline">
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      복사됨!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      마크다운 복사
                    </>
                  )}
                </Button>
                <Button onClick={handleRegenerate} size="sm" variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  처음부터 다시
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleSaveEdit} size="sm" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "저장 중..." : "저장"}
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  size="sm"
                  variant="outline"
                >
                  <X className="mr-2 h-4 w-4" />
                  취소
                </Button>
              </>
            )}
          </div>

          {/* 본문 (보기 / 편집) */}
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[600px] font-mono text-sm"
              placeholder="본문을 편집하세요..."
            />
          ) : (
            <div className="rounded-lg border border-border/50 bg-card p-4 md:p-6">
              {sections.length === 0 ? (
                <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed">
                  {currentContent}
                </pre>
              ) : (
                <div className="space-y-6">
                  {sections.map((section) => {
                    const isSectionSelected =
                      selectedSection === section.number &&
                      selectedParagraph === null;
                    return (
                      <div key={section.number}>
                        {/* 단 헤더 */}
                        <button
                          type="button"
                          onClick={() => handleSectionClick(section.number)}
                          className={`
                            w-full text-left mb-3 px-2 py-1 rounded
                            transition-colors
                            ${
                              isSectionSelected
                                ? "bg-primary/10 ring-2 ring-primary/30"
                                : "hover:bg-muted/50"
                            }
                          `}
                          aria-label={`${section.number}단 ${section.title} 선택`}
                        >
                          <h2 className="text-lg font-bold">
                            <span className="text-primary mr-2">
                              {section.number}단
                            </span>
                            {section.title}
                          </h2>
                        </button>

                        {/* 문단들 */}
                        <div className="space-y-2 pl-2">
                          {section.paragraphs.map((para) => {
                            const isParaSelected =
                              selectedSection === section.number &&
                              selectedParagraph === para.index;
                            return (
                              <button
                                key={para.index}
                                type="button"
                                onClick={() =>
                                  handleParagraphClick(
                                    section.number,
                                    para.index,
                                  )
                                }
                                className={`
                                  w-full text-left p-3 rounded
                                  transition-colors
                                  ${
                                    isParaSelected
                                      ? "bg-primary/10 ring-2 ring-primary/30"
                                      : "hover:bg-muted/50"
                                  }
                                `}
                                aria-label={`${section.number}단 ${para.index + 1}번째 문단 선택`}
                              >
                                <p className="whitespace-pre-wrap text-base leading-relaxed">
                                  {para.text}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 안내 */}
          <p className="mt-4 text-xs text-muted-foreground">
            {isEditing
              ? "💡 편집 모드입니다. 저장 후 다시 AI 다듬기를 사용할 수 있습니다."
              : "💡 단(段) 또는 문단을 클릭하면 오른쪽 패널에서 해당 부분만 재생성·톤조정할 수 있습니다."}
          </p>
        </div>

        {/* 사이드 패널 (편집 중에는 숨김) */}
        {!isEditing && (
          <RefinePanel
            draftId={draft.id}
            sections={sections}
            selectedSection={selectedSection}
            selectedParagraph={selectedParagraph}
            onContentUpdated={handleContentUpdated}
            onClearSelection={clearSelection}
          />
        )}
      </div>
    </div>
  );
}
