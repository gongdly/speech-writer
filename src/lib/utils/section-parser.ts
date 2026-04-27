/**
 * 말씀자료 마크다운을 단(段)·문단으로 파싱
 *
 * 출력 마크다운 구조 (5-Layer L3 출력 형식 기준):
 *   ## 1단 인사말
 *
 *   안녕하십니까. ...
 *
 *   오늘 이 자리에...
 *
 *   ## 2단 행사 의의
 *
 *   ...
 *
 * 단(Section): `## N단 제목` 으로 시작
 * 문단(Paragraph): 단 안의 빈 줄로 구분된 텍스트 블록
 */

export interface ParsedSection {
  /** 단 번호 (1, 2, 3...) */
  number: number;
  /** 단 제목 (예: "인사말", "행사 의의") */
  title: string;
  /** 단 헤더 라인 원본 (예: "## 1단 인사말") */
  headerLine: string;
  /** 단 본문 (헤더 제외) */
  body: string;
  /** 단 시작 라인 인덱스 (마크다운 split 기준) */
  startLine: number;
  /** 단 종료 라인 인덱스 (다음 단 헤더 직전) */
  endLine: number;
  /** 이 단에 포함된 문단들 */
  paragraphs: ParsedParagraph[];
}

export interface ParsedParagraph {
  /** 문단 인덱스 (단 내부, 0부터) */
  index: number;
  /** 문단 텍스트 */
  text: string;
  /** 마크다운 전체에서 시작 라인 인덱스 */
  startLine: number;
  /** 마크다운 전체에서 종료 라인 인덱스 */
  endLine: number;
}

/**
 * 마크다운 본문을 단·문단 구조로 파싱
 */
export function parseMarkdown(markdown: string): ParsedSection[] {
  if (!markdown) return [];

  const lines = markdown.split("\n");
  const sections: ParsedSection[] = [];

  let currentSection: ParsedSection | null = null;
  let currentParagraphLines: string[] = [];
  let currentParagraphStart = 0;

  const flushParagraph = (endLine: number) => {
    if (currentSection && currentParagraphLines.length > 0) {
      const text = currentParagraphLines.join("\n").trim();
      if (text.length > 0) {
        currentSection.paragraphs.push({
          index: currentSection.paragraphs.length,
          text,
          startLine: currentParagraphStart,
          endLine,
        });
      }
    }
    currentParagraphLines = [];
  };

  const flushSection = (endLine: number) => {
    if (currentSection) {
      flushParagraph(endLine);
      currentSection.endLine = endLine;
      currentSection.body = lines
        .slice(currentSection.startLine + 1, currentSection.endLine + 1)
        .join("\n")
        .trim();
      sections.push(currentSection);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 단 헤더 패턴: "## 1단 제목" 또는 "## N단 제목"
    const headerMatch = line.match(/^##\s+(\d+)단\s+(.+?)\s*$/);

    if (headerMatch) {
      // 이전 단 마무리
      flushSection(i - 1);

      // 새 단 시작
      currentSection = {
        number: parseInt(headerMatch[1], 10),
        title: headerMatch[2].trim(),
        headerLine: line,
        body: "",
        startLine: i,
        endLine: i,
        paragraphs: [],
      };
      currentParagraphLines = [];
      currentParagraphStart = i + 1;
    } else if (currentSection) {
      // 빈 줄 → 문단 종료
      if (line.trim() === "") {
        flushParagraph(i - 1);
        currentParagraphStart = i + 1;
      } else {
        currentParagraphLines.push(line);
      }
    }
  }

  // 마지막 단 마무리
  flushSection(lines.length - 1);

  return sections;
}

/**
 * 특정 단을 새 본문으로 교체
 */
export function replaceSection(
  markdown: string,
  sectionNumber: number,
  newBody: string,
): string {
  const sections = parseMarkdown(markdown);
  const target = sections.find((s) => s.number === sectionNumber);
  if (!target) return markdown;

  const lines = markdown.split("\n");
  const before = lines.slice(0, target.startLine + 1).join("\n");
  const after = lines.slice(target.endLine + 1).join("\n");

  // 새 본문이 헤더를 포함하면 제거 (안전장치)
  const cleanBody = newBody.replace(/^##\s+\d+단\s+.+?\n/, "").trim();

  return [before, "", cleanBody, after].filter(Boolean).join("\n");
}

/**
 * 특정 단의 특정 문단을 새 텍스트로 교체
 */
export function replaceParagraph(
  markdown: string,
  sectionNumber: number,
  paragraphIndex: number,
  newText: string,
): string {
  const sections = parseMarkdown(markdown);
  const section = sections.find((s) => s.number === sectionNumber);
  if (!section) return markdown;

  const paragraph = section.paragraphs[paragraphIndex];
  if (!paragraph) return markdown;

  const lines = markdown.split("\n");
  const before = lines.slice(0, paragraph.startLine).join("\n");
  const after = lines.slice(paragraph.endLine + 1).join("\n");

  return [before, newText.trim(), after].filter(Boolean).join("\n");
}

/**
 * 전체 본문에 톤 조정 결과 반영 (전체 교체)
 */
export function replaceFullContent(_oldMarkdown: string, newMarkdown: string): string {
  // 단순 교체 — 향후 검증 로직 추가 가능
  return newMarkdown.trim();
}
