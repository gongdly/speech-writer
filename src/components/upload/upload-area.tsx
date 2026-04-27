"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileUploadZone,
  type UploadedFile,
} from "@/components/upload/file-upload-zone";
import { useLLMSettings } from "@/lib/hooks/use-llm-settings";

interface UploadAreaProps {
  sessionId: string;
  onExtractedEventInfo?: (info: ExtractedEventInfo) => void;
}

export interface ExtractedEventInfo {
  eventName?: string | null;
  eventDate?: string | null;
  eventLocation?: string | null;
  speakerRole?: string | null;
  speakerOrganization?: string | null;
  attendees?: Array<{ name: string; role: string }>;
  keyMessages?: string[];
  citedStats?: string | null;
  confidence?: number;
}

export function UploadArea({ sessionId, onExtractedEventInfo }: UploadAreaProps) {
  const [planFile, setPlanFile] = useState<UploadedFile | null>(null);
  const [referenceFiles, setReferenceFiles] = useState<UploadedFile[]>([]);
  const [extracting, setExtracting] = useState(false);
  const { getAuthPayload, hasAnyKey } = useLLMSettings();

  const handleExtractEventInfo = async (fileId: string) => {
    if (!hasAnyKey) {
      alert(
        "API 키가 설정되지 않았습니다. 설정 페이지에서 키를 등록해 주세요.",
      );
      return;
    }

    const auth = getAuthPayload();
    if (!auth) {
      alert("선택된 모델의 키가 없습니다. 설정을 확인해 주세요.");
      return;
    }

    setExtracting(true);
    try {
      const res = await fetch("/api/extract-event-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, fileId, ...auth }),
      });

      if (res.ok) {
        const info = (await res.json()) as ExtractedEventInfo;
        onExtractedEventInfo?.(info);
      } else {
        const err = (await res.json()) as { error?: string };
        alert(`추출 실패: ${err.error ?? "알 수 없는 오류"}`);
      }
    } catch (e) {
      console.error("Extract failed:", e);
      alert("네트워크 오류로 추출에 실패했습니다.");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 행사 계획서 (단일) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            📎 행사 계획서
            {extracting && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-normal">
                <Loader2 className="w-3 h-3 animate-spin" />
                AI 분석 중...
              </span>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            업로드 시 행사명·일시·참석자가 폼에 자동 입력됩니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadZone
            sessionId={sessionId}
            fileType="plan"
            multiple={false}
            files={planFile ? [planFile] : []}
            onUploaded={(f) => setPlanFile(f)}
            onRemoved={() => setPlanFile(null)}
            onExtractEventInfo={handleExtractEventInfo}
          />
        </CardContent>
      </Card>

      {/* 참고자료 (다중) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            📚 참고자료 (다중)
            <Sparkles className="w-4 h-4 text-primary" />
          </CardTitle>
          <CardDescription className="text-xs">
            정책계획서·통계자료·이전 말씀자료 등 → 본문 RAG 컨텍스트로 활용 (자동 분류)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadZone
            sessionId={sessionId}
            fileType="reference"
            multiple={true}
            files={referenceFiles}
            onUploaded={(f) => setReferenceFiles((prev) => [...prev, f])}
            onRemoved={(id) =>
              setReferenceFiles((prev) => prev.filter((f) => f.fileId !== id))
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
