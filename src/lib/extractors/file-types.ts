/**
 * 파일 형식 판별 + 추출 가능 여부 검증
 */

export type SupportedFileType =
  | "docx"
  | "pdf"
  | "txt"
  | "md"
  | "hwpx"
  | "image";

export const FILE_TYPE_MAP: Record<string, SupportedFileType> = {
  // DOCX
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  // PDF
  "application/pdf": "pdf",
  // TXT
  "text/plain": "txt",
  // Markdown
  "text/markdown": "md",
  "text/x-markdown": "md",
  // HWPX (한글 워드프로세서 - OpenXML 기반 신형)
  "application/haansofthwpx": "hwpx",
  "application/x-hwpx": "hwpx",
  "application/hwp+zip": "hwpx",
  // 이미지 (OCR 엔진 결정 후 활성화)
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
};

export const EXTENSION_MAP: Record<string, SupportedFileType> = {
  docx: "docx",
  pdf: "pdf",
  txt: "txt",
  md: "md",
  markdown: "md",
  mdown: "md",
  mkd: "md",
  hwpx: "hwpx",
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
};

export function detectFileType(
  fileName: string,
  mimeType?: string,
): SupportedFileType | null {
  // 1. MIME 타입 우선 (단, application/octet-stream 같은 무의미한 타입은 무시)
  if (
    mimeType &&
    FILE_TYPE_MAP[mimeType] &&
    mimeType !== "application/octet-stream"
  ) {
    return FILE_TYPE_MAP[mimeType];
  }
  // 2. 확장자 폴백 (브라우저가 .hwpx, .md MIME을 모를 때 흔함)
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext && EXTENSION_MAP[ext]) {
    return EXTENSION_MAP[ext];
  }
  return null;
}

/**
 * 텍스트 추출 가능한지
 */
export function isTextExtractable(type: SupportedFileType): boolean {
  return (
    type === "docx" ||
    type === "pdf" ||
    type === "txt" ||
    type === "md" ||
    type === "hwpx"
  );
  // image는 OCR 엔진 결정 후 활성화
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_REFERENCE_FILES = 10;
