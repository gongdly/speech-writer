/**
 * Gemini 임베딩 API 클라이언트
 *
 * 사용 모델: gemini-embedding-001
 * - 출력 차원: 768 (default), 3072 (max), 1536 등 조정 가능
 * - 무료 티어: 분당 10M 토큰
 * - 결제 카드 등록 불필요
 *
 * 참고: https://ai.google.dev/gemini-api/docs/embeddings
 */

const EMBEDDING_MODEL = "gemini-embedding-001";
const DIMENSIONS = 768; // Supabase 마이그레이션과 동일하게 유지

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface EmbedTextOptions {
  apiKey: string;
  taskType?:
    | "RETRIEVAL_DOCUMENT" // 인덱싱할 문서
    | "RETRIEVAL_QUERY"    // 검색 질의
    | "SEMANTIC_SIMILARITY"
    | "CLASSIFICATION"
    | "CLUSTERING";
  title?: string; // RETRIEVAL_DOCUMENT일 때 권장
}

/**
 * 단일 텍스트 임베딩
 */
export async function embedText(
  text: string,
  opts: EmbedTextOptions,
): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("임베딩할 텍스트가 비어 있습니다");
  }

  const url = `${API_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${opts.apiKey}`;

  const body: Record<string, unknown> = {
    model: `models/${EMBEDDING_MODEL}`,
    content: {
      parts: [{ text: text.slice(0, 30000) }], // Gemini 임베딩 입력 한도 보호
    },
    outputDimensionality: DIMENSIONS,
  };

  if (opts.taskType) {
    body.taskType = opts.taskType;
  }
  if (opts.title) {
    body.title = opts.title;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Gemini 임베딩 실패 (${res.status}): ${errorText.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as {
    embedding?: { values?: number[] };
  };

  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== DIMENSIONS) {
    throw new Error(
      `임베딩 응답 차원 불일치: 예상 ${DIMENSIONS}, 실제 ${values?.length}`,
    );
  }

  return values;
}

/**
 * 배치 임베딩 (한 번에 최대 100개)
 *
 * Gemini batchEmbedContents API 사용. Rate limit 고려해 배치 사이 딜레이 권장.
 */
export async function embedTextBatch(
  texts: string[],
  opts: EmbedTextOptions,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > 100) {
    throw new Error("배치 한도 초과: 한 번에 최대 100개");
  }

  const url = `${API_BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${opts.apiKey}`;

  const requests = texts.map((text) => {
    const req: Record<string, unknown> = {
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text: text.slice(0, 30000) }],
      },
      outputDimensionality: DIMENSIONS,
    };
    if (opts.taskType) req.taskType = opts.taskType;
    return req;
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Gemini 배치 임베딩 실패 (${res.status}): ${errorText.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as {
    embeddings?: Array<{ values?: number[] }>;
  };

  const embeddings = data.embeddings ?? [];
  if (embeddings.length !== texts.length) {
    throw new Error(
      `배치 임베딩 개수 불일치: 요청 ${texts.length}, 응답 ${embeddings.length}`,
    );
  }

  return embeddings.map((e, i) => {
    const values = e.values;
    if (!Array.isArray(values) || values.length !== DIMENSIONS) {
      throw new Error(
        `배치 임베딩 ${i}번 차원 불일치: 예상 ${DIMENSIONS}, 실제 ${values?.length}`,
      );
    }
    return values;
  });
}

/**
 * 사용자 LLM 설정에서 Gemini 키 추출
 *
 * 우선순위:
 *   1. 명시적으로 전달된 key
 *   2. 환경변수 GEMINI_API_KEY (Vercel Cron 등 서버 작업용)
 */
export function resolveGeminiKey(explicitKey?: string): string {
  if (explicitKey) return explicitKey;
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) return envKey;
  throw new Error(
    "Gemini API 키 없음. 사용자 설정에 등록하거나 GEMINI_API_KEY 환경변수를 설정하세요.",
  );
}

/**
 * 텍스트를 청크로 분할 (한국어 친화적, 문장 경계 우선)
 *
 * 기준:
 *   - 청크 크기: 약 500자 (오버랩 50자)
 *   - 문장 경계(., 다., 까. 등) 우선 분리
 *   - 너무 짧은 청크는 다음 청크와 합침
 */
export function chunkText(
  text: string,
  options: { chunkSize?: number; overlap?: number; minChunk?: number } = {},
): string[] {
  const chunkSize = options.chunkSize ?? 500;
  const overlap = options.overlap ?? 50;
  const minChunk = options.minChunk ?? 100;

  if (!text || text.trim().length === 0) return [];

  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= chunkSize) {
    return cleaned.length >= minChunk ? [cleaned] : [];
  }

  // 문장 단위 분리 (한국어 종결 + 영문 종결)
  const sentences = cleaned.split(/(?<=[.!?다음니다요죠]\s)|(?<=\n\n)/);

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize) {
      if (current.length >= minChunk) {
        chunks.push(current.trim());
      }
      // 오버랩 처리: 직전 청크의 마지막 일부를 새 청크 앞에 포함
      const tail = current.slice(-overlap);
      current = tail + sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim().length >= minChunk) {
    chunks.push(current.trim());
  }

  return chunks;
}
