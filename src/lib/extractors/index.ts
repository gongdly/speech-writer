/**
 * 파일별 텍스트 추출기
 *
 * MVP는 DOCX·PDF·TXT 지원. HWPX와 이미지 OCR은 차후 확장.
 */

import type { SupportedFileType } from "./file-types";

export interface ExtractResult {
  text: string;
  charCount: number;
  warning?: string;
}

/**
 * 통합 추출 인터페이스
 */
export async function extractText(
  type: SupportedFileType,
  buffer: ArrayBuffer,
): Promise<ExtractResult> {
  switch (type) {
    case "docx":
      return await extractDocx(buffer);
    case "pdf":
      return await extractPdf(buffer);
    case "txt":
      return await extractTxt(buffer);
    case "hwpx":
      throw new Error("HWPX 추출은 현재 지원하지 않습니다. DOCX·PDF로 변환해 업로드하세요.");
    case "image":
      throw new Error("이미지 OCR은 현재 지원하지 않습니다. 텍스트 파일로 업로드하세요.");
    default:
      throw new Error(`지원하지 않는 파일 형식: ${type}`);
  }
}

/**
 * DOCX 추출 (mammoth)
 */
async function extractDocx(buffer: ArrayBuffer): Promise<ExtractResult> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const text = normalizeText(result.value);
  return {
    text,
    charCount: text.length,
    warning: result.messages.length > 0 ? "일부 서식이 손실되었을 수 있습니다." : undefined,
  };
}

/**
 * PDF 추출 (pdf-parse)
 */
async function extractPdf(buffer: ArrayBuffer): Promise<ExtractResult> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(Buffer.from(buffer));
  const text = normalizeText(data.text);
  return {
    text,
    charCount: text.length,
    warning: text.length < 100 ? "PDF에서 추출된 텍스트가 매우 짧습니다. 스캔본일 가능성." : undefined,
  };
}

/**
 * TXT 추출 (UTF-8 디코딩)
 */
async function extractTxt(buffer: ArrayBuffer): Promise<ExtractResult> {
  const decoder = new TextDecoder("utf-8");
  const text = normalizeText(decoder.decode(buffer));
  return {
    text,
    charCount: text.length,
  };
}

/**
 * 추출된 텍스트 정규화
 * - 과도한 공백·개행 정리
 * - 컨트롤 문자 제거
 */
function normalizeText(raw: string): string {
  return raw
    .replace(/\u0000/g, "") // null
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 민감정보 마스킹
 * - 주민등록번호 (123456-1234567)
 * - 전화번호 (010-1234-5678)
 * - 이메일
 * - 계좌번호 (잠재적, 8자 이상 숫자 연속)
 */
export function maskSensitive(text: string): string {
  return text
    .replace(/\d{6}-\d{7}/g, "[주민번호 마스킹]")
    .replace(/01[0-9]-?\d{3,4}-?\d{4}/g, "[전화번호 마스킹]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[이메일 마스킹]")
    .replace(/\b\d{8,}\b/g, (m) => (m.length >= 10 ? "[숫자 마스킹]" : m));
}
