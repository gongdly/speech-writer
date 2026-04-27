"use client";

import { useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, FileText, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_FILE_SIZE, MAX_REFERENCE_FILES } from "@/lib/extractors/file-types";
import { REFERENCE_CATEGORY_MAP } from "@/lib/data/reference-categories";
import { useLLMSettings } from "@/lib/hooks/use-llm-settings";

export interface UploadedFile {
  fileId: string;
  fileName: string;
  fileType: "plan" | "reference";
  charCount: number;
  category?: string;
  extractedTextPreview?: string;
  warning?: string;
}

interface FileUploadZoneProps {
  sessionId: string;
  fileType: "plan" | "reference";
  multiple?: boolean;
  files: UploadedFile[];
  onUploaded: (file: UploadedFile) => void;
  onRemoved: (fileId: string) => void;
  onExtractEventInfo?: (fileId: string) => void; // 행사계획서 전용
}

const ACCEPT = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
};

export function FileUploadZone({
  sessionId,
  fileType,
  multiple = false,
  files,
  onUploaded,
  onRemoved,
  onExtractEventInfo,
}: FileUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAuthPayload } = useLLMSettings();

  const handleDrop = async (accepted: File[], rejections: FileRejection[]) => {
    setError(null);

    if (rejections.length > 0) {
      setError(rejections[0].errors[0]?.message ?? "지원하지 않는 파일");
      return;
    }

    // 다중 업로드 시 최대 개수 체크
    if (fileType === "reference") {
      const remaining = MAX_REFERENCE_FILES - files.length;
      if (accepted.length > remaining) {
        setError(`최대 ${MAX_REFERENCE_FILES}개까지 업로드 가능 (현재 ${files.length}개)`);
        return;
      }
    }

    setUploading(true);
    try {
      for (const file of accepted) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("sessionId", sessionId);
        formData.append("fileType", fileType);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `업로드 실패: ${file.name}`);
        }

        const data = (await res.json()) as UploadedFile;
        onUploaded(data);

        // 참고자료는 자동 분류 호출
        if (fileType === "reference") {
          const auth = getAuthPayload();
          if (auth) {
            fetch("/api/classify-reference", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId, fileId: data.fileId, ...auth }),
            }).catch((e) => console.error("Classify failed:", e));
          } else {
            console.warn(
              "API 키가 설정되지 않아 자동 분류를 건너뜁니다. 설정 페이지에서 키를 등록해 주세요.",
            );
          }
        }

        // 행사계획서는 폼 자동 채움
        if (fileType === "plan" && onExtractEventInfo) {
          onExtractEventInfo(data.fileId);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (fileId: string) => {
    try {
      const res = await fetch(`/api/contexts?sessionId=${sessionId}&fileId=${fileId}`, {
        method: "DELETE",
      });
      if (res.ok) onRemoved(fileId);
    } catch (e) {
      console.error("Remove failed:", e);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: ACCEPT,
    multiple,
    maxSize: MAX_FILE_SIZE,
    disabled: uploading || (fileType === "reference" && files.length >= MAX_REFERENCE_FILES),
  });

  const reachedMax = fileType === "reference" && files.length >= MAX_REFERENCE_FILES;

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "rounded-md border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
          isDragActive ? "border-primary bg-primary/5" : "hover:bg-accent",
          (uploading || reachedMax) && "opacity-50 cursor-not-allowed",
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        {uploading ? (
          <p className="text-sm font-medium">
            <Loader2 className="inline w-4 h-4 mr-1 animate-spin" />
            업로드 중...
          </p>
        ) : reachedMax ? (
          <p className="text-sm text-muted-foreground">최대 {MAX_REFERENCE_FILES}개 도달</p>
        ) : (
          <>
            <p className="text-sm font-medium">
              {isDragActive ? "여기에 놓으세요" : "파일을 끌어다 놓거나 클릭"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              지원: DOCX, PDF, TXT · 최대 {MAX_FILE_SIZE / 1024 / 1024}MB
              {multiple && ` · 최대 ${MAX_REFERENCE_FILES}개`}
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.fileId}
              className="flex items-start gap-3 p-3 rounded-md border bg-card"
            >
              <FileText className="w-5 h-5 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{f.fileName}</p>
                  {f.category && REFERENCE_CATEGORY_MAP[f.category as keyof typeof REFERENCE_CATEGORY_MAP] && (
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        REFERENCE_CATEGORY_MAP[f.category as keyof typeof REFERENCE_CATEGORY_MAP].badge,
                      )}
                    >
                      {REFERENCE_CATEGORY_MAP[f.category as keyof typeof REFERENCE_CATEGORY_MAP].label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {f.charCount.toLocaleString()}자 추출됨
                </p>
                {f.warning && (
                  <p className="text-xs text-amber-700 mt-1">⚠ {f.warning}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(f.fileId)}
                aria-label="삭제"
              >
                <X className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
