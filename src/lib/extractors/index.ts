/**
 * 파일별 텍스트 추출기
 *
 * 지원: DOCX, PDF, TXT, MD, HWPX. 이미지 OCR은 차후 확장.
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
    case "md":
      return await extractMarkdown(buffer);
    case "hwpx":
      return await extractHwpx(buffer);
    case "image":
      throw new Error(
        "이미지 OCR은 현재 지원하지 않습니다. 텍스트 파일로 업로드하세요.",
      );
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
    warning:
      result.messages.length > 0
        ? "일부 서식이 손실되었을 수 있습니다."
        : undefined,
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
    warning:
      text.length < 100
        ? "PDF에서 추출된 텍스트가 매우 짧습니다. 스캔본일 가능성."
        : undefined,
  };
}

/**
 * TXT 추출 (UTF-8 디코딩, EUC-KR fallback)
 */
async function extractTxt(buffer: ArrayBuffer): Promise<ExtractResult> {
  let text = decodeTextSafe(buffer);
  text = normalizeText(text);
  return { text, charCount: text.length };
}

/**
 * Markdown 추출 (간단한 마크다운 문법은 보존, 텍스트로 변환)
 */
async function extractMarkdown(buffer: ArrayBuffer): Promise<ExtractResult> {
  let raw = decodeTextSafe(buffer);

  // 마크다운 본문 그대로 사용 — LLM이 마크다운을 자연스럽게 이해함
  // 단, 코드 블록 등 본문 분량을 과도하게 부풀리는 부분만 정리
  const text = normalizeText(raw);

  return {
    text,
    charCount: text.length,
  };
}

/**
 * HWPX 추출 (ZIP 아카이브 → Contents/section*.xml 파싱)
 *
 * HWPX 구조:
 *   - HWPX는 한글의 OpenXML 기반 포맷 (한글 2014 이후)
 *   - ZIP 안에 Contents/section0.xml, section1.xml ... 형태로 페이지별 XML
 *   - 각 XML에 <hp:t> 태그로 실제 텍스트가 들어 있음
 *   - 일부 파일은 Preview/PrvText.txt에 미리보기 텍스트 보유 (fallback)
 *
 * 구형 HWP(바이너리 OLE)는 별도 처리 필요 — 본 함수는 HWPX 전용.
 */
async function extractHwpx(buffer: ArrayBuffer): Promise<ExtractResult> {
  let JSZip;
  try {
    JSZip = (await import("jszip")).default;
  } catch (e) {
    throw new Error(
      "HWPX 처리 라이브러리(jszip) 로드 실패. npm install이 필요합니다.",
    );
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    throw new Error(
      "HWPX 파일을 열 수 없습니다. 파일이 손상되었거나 구형 HWP(바이너리)일 수 있습니다. HWPX 또는 DOCX·PDF로 변환해 주세요.",
    );
  }

  // 1차: Contents/section*.xml 모두 추출
  const sectionFiles = Object.keys(zip.files)
    .filter(
      (path) =>
        /^Contents\/section\d+\.xml$/i.test(path) ||
        /^contents\/section\d+\.xml$/i.test(path),
    )
    .sort(); // section0, section1, section2 ... 순서 보장

  const parts: string[] = [];

  for (const path of sectionFiles) {
    const file = zip.file(path);
    if (!file) continue;
    try {
      const xml = await file.async("string");
      const sectionText = parseHwpxSection(xml);
      if (sectionText) parts.push(sectionText);
    } catch (e) {
      console.warn(`HWPX section 파싱 실패 (${path}):`, e);
    }
  }

  let text = parts.join("\n\n");
  let warning: string | undefined;

  // 2차 fallback: Preview/PrvText.txt (section 추출 실패 시)
  if (text.trim().length === 0) {
    const previewFile =
      zip.file("Preview/PrvText.txt") || zip.file("preview/prvtext.txt");
    if (previewFile) {
      try {
        text = await previewFile.async("string");
        warning =
          "본문 추출 실패로 미리보기 텍스트만 사용했습니다. 일부 내용이 누락되었을 수 있습니다.";
      } catch (e) {
        // 무시
      }
    }
  }

  if (text.trim().length === 0) {
    throw new Error(
      "HWPX 파일에서 텍스트를 추출하지 못했습니다. 한글 프로그램에서 다시 저장하거나 DOCX·PDF로 변환해 보세요.",
    );
  }

  text = normalizeText(text);

  return {
    text,
    charCount: text.length,
    warning,
  };
}

/**
 * HWPX section XML에서 텍스트 추출
 *
 * 주요 텍스트 컨테이너:
 *   - <hp:t>...</hp:t>     : 일반 텍스트 런
 *   - <hp:p>...</hp:p>     : 문단 (하위에 hp:t 포함)
 *   - 네임스페이스 prefix는 hp 외에도 다양 가능 (hp:, w:, 또는 없음)
 *
 * 안전하게 정규식으로 모든 <*:t>...</*:t> 와 <t>...</t> 추출.
 * 문단 경계는 <*:p> 태그로 인식해 줄바꿈.
 */
function parseHwpxSection(xml: string): string {
  if (!xml) return "";

  // 문단 태그를 줄바꿈 마커로 치환 (텍스트 추출 전)
  let processed = xml.replace(/<\/(hp:)?p>/gi, "\n\n");

  // 모든 텍스트 런 (<hp:t>, <t> 등) 추출
  const tPattern =
    /<(?:[a-z]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[a-z]+:)?t>/gi;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tPattern.exec(processed)) !== null) {
    const inner = decodeXmlEntities(m[1]);
    if (inner.trim().length > 0) {
      matches.push(inner);
    }
  }

  if (matches.length === 0) {
    // 텍스트 런이 없으면 모든 XML 태그 제거 후 평문화
    return decodeXmlEntities(processed.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
  }

  // 원래 XML에서 문단 경계 위치를 추적해 줄바꿈 보존
  // 간단화: 추출된 텍스트들을 공백으로 잇되, 문단 경계는 \n\n
  // (정확도보다 가독성 우선 — LLM이 문맥 이해)
  return matches.join(" ").replace(/\s{3,}/g, "\n\n");
}

/**
 * XML 엔티티 디코딩
 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

/**
 * UTF-8 우선, 깨지면 EUC-KR 시도 (한국 정부 문서에 종종)
 */
function decodeTextSafe(buffer: ArrayBuffer): string {
  try {
    const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return utf8;
  } catch {
    try {
      // Node 환경에서 euc-kr 직접 디코딩 (브라우저 호환)
      return new TextDecoder("euc-kr").decode(buffer);
    } catch {
      // 마지막 수단: lossy UTF-8
      return new TextDecoder("utf-8").decode(buffer);
    }
  }
}

/**
 * 추출된 텍스트 정규화
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
 */
export function maskSensitive(text: string): string {
  return text
    .replace(/\d{6}-\d{7}/g, "[주민번호 마스킹]")
    .replace(/01[0-9]-?\d{3,4}-?\d{4}/g, "[전화번호 마스킹]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[이메일 마스킹]")
    .replace(/\b\d{8,}\b/g, (m) => (m.length >= 10 ? "[숫자 마스킹]" : m));
}
