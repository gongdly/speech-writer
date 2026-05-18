/**
 * 한국 정부 RSS 파서
 *
 * 지원 포맷:
 *   - 정책브리핑 (korea.kr) — 표준 RSS 2.0
 *   - 행정안전부, 고용노동부 등 부처 보도자료 — 표준 RSS 2.0 변형
 *
 * 외부 라이브러리 미사용 (정규식 기반 — Vercel Edge·Node 모두 동작)
 */

export interface ParsedArticle {
  guid: string;
  title: string;
  link: string;
  pubDate: number | null; // Unix ms
  description: string;
  content: string; // 본문 (description 또는 content:encoded)
}

/**
 * RSS XML 문자열 파싱
 */
export function parseRss(xml: string): ParsedArticle[] {
  if (!xml || xml.trim().length === 0) return [];

  const items: ParsedArticle[] = [];

  // <item>...</item> 또는 <entry>...</entry> (Atom) 추출
  const itemPattern = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(xml)) !== null) {
    const itemXml = match[2];
    const article = parseItem(itemXml);
    if (article) items.push(article);
  }

  return items;
}

function parseItem(itemXml: string): ParsedArticle | null {
  const title = extractTag(itemXml, "title");
  const link = extractLink(itemXml);

  if (!title || !link) return null;

  const guidRaw = extractTag(itemXml, "guid") || link;
  const guid = guidRaw.trim();

  const pubDateStr =
    extractTag(itemXml, "pubDate") ||
    extractTag(itemXml, "dc:date") ||
    extractTag(itemXml, "published") ||
    extractTag(itemXml, "updated");
  const pubDate = pubDateStr ? parseDate(pubDateStr) : null;

  const description =
    extractTag(itemXml, "description") || extractTag(itemXml, "summary") || "";

  // content:encoded가 있으면 우선 사용 (전체 본문)
  const contentEncoded = extractTag(itemXml, "content:encoded");
  const content = stripHtml(contentEncoded || description);

  return {
    guid,
    title: stripHtml(title).trim(),
    link: link.trim(),
    pubDate,
    description: stripHtml(description),
    content,
  };
}

/**
 * 단일 태그 내용 추출 (CDATA 처리 포함)
 */
function extractTag(xml: string, tagName: string): string {
  const escapedTag = tagName.replace(/:/g, "\\:");
  const re = new RegExp(
    `<${escapedTag}\\b[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${escapedTag}>`,
    "i",
  );
  const m = xml.match(re);
  if (!m) return "";
  return decodeEntities((m[1] ?? m[2] ?? "").trim());
}

/**
 * link 태그 추출 (RSS와 Atom 모두 지원)
 *
 * RSS:  <link>https://...</link>
 * Atom: <link href="https://..." />
 */
function extractLink(itemXml: string): string {
  // RSS 형식 우선
  const rssLink = extractTag(itemXml, "link");
  if (rssLink && rssLink.startsWith("http")) return rssLink;

  // Atom 형식
  const atomMatch = itemXml.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atomMatch) return atomMatch[1];

  return rssLink || "";
}

/**
 * HTML 엔티티 디코딩
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

/**
 * HTML 태그 제거 (본문에서 텍스트만 추출)
 */
function stripHtml(html: string): string {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

/**
 * 다양한 날짜 포맷 파싱
 *
 * 지원 형식:
 *   - RFC 822: "Tue, 15 Apr 2025 09:30:00 +0900"
 *   - ISO 8601: "2025-04-15T09:30:00+09:00"
 *   - "2025-04-15 09:30:00"
 *   - "2025-04-15"
 */
function parseDate(dateStr: string): number | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();

  // 표준 Date.parse 시도
  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) return parsed;

  // "YYYY-MM-DD HH:mm:ss" 형식 (한국 부처 RSS에서 종종)
  const m = cleaned.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[\sT](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
    // 한국 시간으로 가정
    const date = new Date(
      `${y}-${mo}-${d}T${h.padStart(2, "0")}:${mi.padStart(2, "0")}:${s.padStart(2, "0")}+09:00`,
    );
    if (!isNaN(date.getTime())) return date.getTime();
  }

  return null;
}

/**
 * RSS URL에서 직접 fetch + 파싱
 *
 * 한국 정부 사이트는 종종 UTF-8이 아닌 EUC-KR을 쓰므로 Content-Type 확인 필요.
 * 일단 UTF-8 가정하고, 실패 시 별도 처리.
 *
 * ⚠️ User-Agent 주의:
 *   한국 정부 사이트는 UA 문자열에 "bot", "crawler", "spider" 등 키워드가 있으면
 *   즉시 차단(403 또는 연결 거부)합니다. Node.js 기본 UA(undici/...)도 봇으로 분류됨.
 *   → 반드시 일반 브라우저 UA 사용.
 *
 * ⚠️ 타임아웃:
 *   한국 정부 사이트는 해외 IP(예: Vercel iad1)에서 응답을 매우 느리게 보냅니다.
 *   완전 차단은 아닌 듯하나 throttle이 걸린 것으로 추정. 30초까지 대기.
 */
export async function fetchAndParseRss(rssUrl: string): Promise<ParsedArticle[]> {
  // 타임아웃 (30초) — 해외 IP에서 한국 정부 사이트가 응답 지연을 보일 때 대응
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  const startTime = Date.now();

  let res: Response;
  try {
    res = await fetch(rssUrl, {
      headers: {
        // 일반 브라우저 UA로 위장 (Chrome 최신 안정 버전)
        // "bot" 키워드가 들어가면 한국 정부 사이트에서 차단됨
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "application/rss+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (e) {
    // 네트워크 레벨 실패 (DNS, timeout, 연결 거부 등) → "fetch failed"로 잡힘
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    const reason = e instanceof Error ? e.message : String(e);
    const errCode = e instanceof Error && "cause" in e ? String((e as { cause: unknown }).cause) : "";
    if (reason.includes("aborted")) {
      throw new Error(`RSS 응답 시간 초과 (${Math.round(elapsed / 1000)}s): ${rssUrl}`);
    }
    throw new Error(`RSS 연결 실패 (${Math.round(elapsed / 1000)}s, ${errCode || reason}): ${rssUrl}`);
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`RSS fetch 실패 (HTTP ${res.status}): ${rssUrl}`);
  }

  const text = await res.text();
  if (!text || text.length < 50) {
    throw new Error(`RSS 응답이 비어있거나 너무 짧음 (${text.length}자): ${rssUrl}`);
  }
  return parseRss(text);
}
