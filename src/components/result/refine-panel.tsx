"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  RefreshCw,
  Wand2,
  X,
  AlertCircle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useLLMSettings } from "@/lib/hooks/use-llm-settings";
import type { ParsedSection } from "@/lib/utils/section-parser";

interface RefinePanelProps {
  draftId: string;
  sections: ParsedSection[];
  selectedSection: number | null;
  selectedParagraph: number | null;
  onContentUpdated: (newContent: string) => void;
  onClearSelection: () => void;
}

type Mode = "regenerate" | "tone";

export function RefinePanel({
  draftId,
  sections,
  selectedSection,
  selectedParagraph,
  onContentUpdated,
  onClearSelection,
}: RefinePanelProps) {
  const { getAuthPayload } = useLLMSettings();

  const [mode, setMode] = useState<Mode>("regenerate");
  const [instruction, setInstruction] = useState("");
  const [toneScope, setToneScope] = useState<"all" | "section">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // 모바일에서 패널 토글
  const togglePanel = () => setCollapsed((c) => !c);

  const targetSection =
    selectedSection !== null
      ? sections.find((s) => s.number === selectedSection)
      : null;

  const handleRegenerate = async () => {
    if (selectedSection === null) {
      setError("재생성할 단을 본문에서 선택해 주세요");
      return;
    }

    const auth = getAuthPayload();
    if (!auth) {
      setError("API 키가 설정되지 않았습니다. 설정 페이지에서 등록해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/regenerate-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          provider: auth.provider,
          model: auth.model,
          apiKey: auth.apiKey,
          scope: selectedParagraph !== null ? "paragraph" : "section",
          sectionNumber: selectedSection,
          paragraphIndex: selectedParagraph ?? undefined,
          instruction: instruction.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "재생성 실패");

      onContentUpdated(data.content);
      setInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "재생성 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustTone = async () => {
    if (!instruction.trim()) {
      setError("톤 조정 지시를 입력해 주세요 (예: '좀 더 따뜻하게')");
      return;
    }

    const auth = getAuthPayload();
    if (!auth) {
      setError("API 키가 설정되지 않았습니다.");
      return;
    }

    if (toneScope === "section" && selectedSection === null) {
      setError("단 단위 톤 조정은 본문에서 단을 먼저 선택해 주세요");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/adjust-tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          provider: auth.provider,
          model: auth.model,
          apiKey: auth.apiKey,
          instruction: instruction.trim(),
          scope: toneScope,
          sectionNumber: toneScope === "section" ? selectedSection : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "톤 조정 실패");

      onContentUpdated(data.content);
      setInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "톤 조정 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 모바일 토글 버튼 */}
      <button
        type="button"
        onClick={togglePanel}
        className="md:hidden fixed bottom-4 right-4 z-30 bg-primary text-primary-foreground rounded-full shadow-lg w-14 h-14 flex items-center justify-center"
        aria-label={collapsed ? "다듬기 패널 열기" : "다듬기 패널 닫기"}
      >
        {collapsed ? <Wand2 className="w-6 h-6" /> : <X className="w-6 h-6" />}
      </button>

      <aside
        className={`
          ${collapsed ? "translate-y-full md:translate-y-0" : "translate-y-0"}
          fixed bottom-0 left-0 right-0 md:relative md:translate-y-0
          bg-background border-t md:border-t-0 md:border-l
          transition-transform duration-300 ease-in-out
          z-20 md:z-0
          max-h-[70vh] md:max-h-none
          overflow-y-auto
          md:w-80 md:flex-shrink-0
        `}
      >
        <div className="p-4 space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">다듬기</h2>
            </div>
            <button
              type="button"
              onClick={togglePanel}
              className="md:hidden text-muted-foreground"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* 모드 탭 */}
          <div className="flex gap-1 p-1 bg-muted rounded-md">
            <button
              type="button"
              onClick={() => {
                setMode("regenerate");
                setError(null);
              }}
              className={`flex-1 text-sm py-1.5 rounded ${
                mode === "regenerate"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground"
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
              재생성
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("tone");
                setError(null);
              }}
              className={`flex-1 text-sm py-1.5 rounded ${
                mode === "tone"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground"
              }`}
            >
              <Wand2 className="w-3.5 h-3.5 inline mr-1" />
              톤 조정
            </button>
          </div>

          {/* 선택 표시 */}
          {selectedSection !== null && targetSection && (
            <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-primary">
                    선택됨: {targetSection.number}단 {targetSection.title}
                  </div>
                  {selectedParagraph !== null && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {selectedParagraph + 1}번째 문단
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="선택 해제"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 재생성 모드 */}
          {mode === "regenerate" && (
            <div className="space-y-3">
              {selectedSection === null && (
                <p className="text-xs text-muted-foreground">
                  본문에서 다시 작성하고 싶은 단(段) 또는 문단을 클릭해 주세요.
                </p>
              )}

              <div>
                <Label htmlFor="regen-instruction" className="text-xs">
                  추가 지시 (선택)
                </Label>
                <Textarea
                  id="regen-instruction"
                  placeholder="예: 좀 더 짧게, 사례를 추가해서, 인용구 빼고..."
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={3}
                  className="mt-1 text-sm"
                />
              </div>

              <Button
                onClick={handleRegenerate}
                disabled={loading || selectedSection === null}
                className="w-full"
                size="sm"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    재생성 중...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {selectedParagraph !== null ? "이 문단 재생성" : "이 단 재생성"}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* 톤 조정 모드 */}
          {mode === "tone" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">적용 범위</Label>
                <div className="flex gap-1 mt-1 p-1 bg-muted rounded-md">
                  <button
                    type="button"
                    onClick={() => setToneScope("all")}
                    className={`flex-1 text-xs py-1.5 rounded ${
                      toneScope === "all"
                        ? "bg-background shadow-sm font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    전체
                  </button>
                  <button
                    type="button"
                    onClick={() => setToneScope("section")}
                    disabled={selectedSection === null}
                    className={`flex-1 text-xs py-1.5 rounded disabled:opacity-50 ${
                      toneScope === "section"
                        ? "bg-background shadow-sm font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    선택 단만
                  </button>
                </div>
                {toneScope === "section" && selectedSection === null && (
                  <p className="text-xs text-amber-700 mt-1">
                    본문에서 단을 먼저 선택하세요.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="tone-instruction" className="text-xs">
                  톤 조정 지시 <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="tone-instruction"
                  placeholder="예: 좀 더 따뜻하게, 격식 있게, 친근하게, 간결하게..."
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={3}
                  className="mt-1 text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  내용·구조·분량은 유지되고 톤만 조정됩니다.
                </p>
              </div>

              <Button
                onClick={handleAdjustTone}
                disabled={loading || !instruction.trim()}
                className="w-full"
                size="sm"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    조정 중...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    톤 조정 적용
                  </>
                )}
              </Button>
            </div>
          )}

          {/* 에러 표시 */}
          {error && (
            <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 도움말 */}
          <div className="pt-3 border-t text-[11px] text-muted-foreground space-y-1">
            <p className="font-medium">사용 팁</p>
            <p>• 본문의 단(段) 제목을 클릭하면 그 단이 선택됩니다.</p>
            <p>• 문단을 클릭하면 그 문단만 재생성할 수 있습니다.</p>
            <p>• 톤 조정은 자유롭게 한국어로 지시하세요.</p>
          </div>
        </div>
      </aside>
    </>
  );
}
