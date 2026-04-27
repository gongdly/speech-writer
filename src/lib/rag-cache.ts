/**
 * RAG 컨텍스트 캐시
 *
 * Cloudflare KV → Supabase 테이블로 변경.
 * 추출된 파일 본문 텍스트를 임시 저장 (1시간 TTL은 cron으로 정리).
 *
 * 동일 함수 시그니처 유지하여 다른 코드 변경 없음.
 */

import { createServerClient } from "./supabase/server";

export interface RagContext {
  fileId: string;
  fileName: string;
  fileType: "plan" | "reference";
  category?: string;
  text: string;
  charCount: number;
  extractedStats?: Record<string, unknown>;
  uploadedAt: number;
}

const TTL_1H_MS = 60 * 60 * 1000;
const TTL_24H_MS = 24 * 60 * 60 * 1000;

// ============================================================
// RAG 컨텍스트
// ============================================================

export async function saveRagContext(
  sessionId: string,
  fileId: string,
  ctx: RagContext,
): Promise<void> {
  const sb = createServerClient();
  const key = `ctx:${sessionId}:${fileId}`;
  const expiresAt = Date.now() + TTL_1H_MS;

  const { error } = await sb.from("rag_contexts").upsert({
    cache_key: key,
    session_id: sessionId,
    file_id: fileId,
    payload: ctx,
    expires_at: expiresAt,
  });

  if (error) throw new Error(`saveRagContext failed: ${error.message}`);
}

export async function getRagContext(
  sessionId: string,
  fileId: string,
): Promise<RagContext | null> {
  const sb = createServerClient();
  const key = `ctx:${sessionId}:${fileId}`;
  const now = Date.now();

  const { data, error } = await sb
    .from("rag_contexts")
    .select("payload, expires_at")
    .eq("cache_key", key)
    .maybeSingle();

  if (error) throw new Error(`getRagContext failed: ${error.message}`);
  if (!data) return null;

  // 만료 확인
  if ((data.expires_at as number) < now) return null;

  return data.payload as RagContext;
}

export async function listRagContextsBySession(
  sessionId: string,
): Promise<RagContext[]> {
  const sb = createServerClient();
  const now = Date.now();

  const { data, error } = await sb
    .from("rag_contexts")
    .select("payload, expires_at")
    .eq("session_id", sessionId)
    .gt("expires_at", now);

  if (error)
    throw new Error(`listRagContextsBySession failed: ${error.message}`);

  return (data ?? []).map((row) => row.payload as RagContext);
}

// ============================================================
// 프롬프트 캐시
// ============================================================

export async function getPromptCache(hash: string): Promise<string | null> {
  const sb = createServerClient();
  const now = Date.now();

  const { data, error } = await sb
    .from("prompt_cache")
    .select("value, expires_at")
    .eq("hash", hash)
    .maybeSingle();

  if (error) throw new Error(`getPromptCache failed: ${error.message}`);
  if (!data) return null;
  if ((data.expires_at as number) < now) return null;

  return data.value as string;
}

export async function setPromptCache(
  hash: string,
  value: string,
): Promise<void> {
  const sb = createServerClient();
  const expiresAt = Date.now() + TTL_24H_MS;

  const { error } = await sb.from("prompt_cache").upsert({
    hash,
    value,
    expires_at: expiresAt,
  });

  if (error) throw new Error(`setPromptCache failed: ${error.message}`);
}
