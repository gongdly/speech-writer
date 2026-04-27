/**
 * RAG 테이블 접근 헬퍼 (Supabase)
 *
 * 다루는 테이블:
 *   - rss_sources
 *   - rag_articles
 *   - rag_chunks (with embedding)
 *   - rag_sync_logs
 */

import { createServerClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

export interface RssSource {
  id: string;
  name: string;
  category: "policy_briefing" | "ministry_press";
  ministry: string | null;
  rss_url: string;
  is_active: boolean;
  last_synced_at: number | null;
  last_status: string | null;
  total_articles: number;
  created_at: number;
  updated_at: number;
}

export interface RagArticle {
  id: string;
  source_id: string;
  title: string;
  link: string;
  pub_date: number | null;
  content: string | null;
  description: string | null;
  ministry: string | null;
  guid: string;
  created_at: number;
  updated_at: number;
}

export interface RagChunkInsert {
  id: string;
  article_id: string;
  chunk_idx: number;
  content: string;
  embedding: number[];
  token_count?: number;
  created_at: number;
}

export interface MatchedChunk {
  chunk_id: string;
  article_id: string;
  content: string;
  similarity: number;
  article_title: string;
  article_link: string;
  article_pub_date: number | null;
  article_ministry: string | null;
  source_name: string;
  source_category: string;
}

// ============================================================================
// RSS 소스 관리
// ============================================================================

export async function listActiveRssSources(): Promise<RssSource[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("rss_sources")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true });

  if (error) throw new Error(`listActiveRssSources failed: ${error.message}`);
  return (data as RssSource[]) ?? [];
}

export async function listAllRssSources(): Promise<RssSource[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("rss_sources")
    .select("*")
    .order("category", { ascending: true });

  if (error) throw new Error(`listAllRssSources failed: ${error.message}`);
  return (data as RssSource[]) ?? [];
}

export async function updateRssSourceStatus(
  sourceId: string,
  status: "ok" | string,
  totalArticles?: number,
): Promise<void> {
  const sb = createServerClient();
  const update: Record<string, unknown> = {
    last_synced_at: Date.now(),
    last_status: status,
    updated_at: Date.now(),
  };
  if (typeof totalArticles === "number") {
    update.total_articles = totalArticles;
  }

  const { error } = await sb
    .from("rss_sources")
    .update(update)
    .eq("id", sourceId);

  if (error) throw new Error(`updateRssSourceStatus failed: ${error.message}`);
}

// ============================================================================
// 기사 (rag_articles)
// ============================================================================

/**
 * guid로 이미 존재하는 기사 ID 조회 (중복 방지용)
 */
export async function findExistingArticleGuids(
  guids: string[],
): Promise<Set<string>> {
  if (guids.length === 0) return new Set();
  const sb = createServerClient();
  const { data, error } = await sb
    .from("rag_articles")
    .select("guid")
    .in("guid", guids);

  if (error)
    throw new Error(`findExistingArticleGuids failed: ${error.message}`);

  return new Set((data ?? []).map((r) => (r as { guid: string }).guid));
}

export async function insertArticle(
  article: Omit<RagArticle, "id" | "created_at" | "updated_at">,
): Promise<RagArticle> {
  const sb = createServerClient();
  const id = `a_${nanoid(12)}`;
  const now = Date.now();
  const row: RagArticle = {
    ...article,
    id,
    created_at: now,
    updated_at: now,
  };

  const { error } = await sb.from("rag_articles").insert(row);
  if (error) throw new Error(`insertArticle failed: ${error.message}`);

  return row;
}

/**
 * 1년 이상 된 기사 정리 (cron에서 호출)
 */
export async function deleteArticlesOlderThan(
  cutoffMs: number,
): Promise<number> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("rag_articles")
    .delete()
    .lt("pub_date", cutoffMs)
    .select("id");

  if (error) throw new Error(`deleteArticlesOlderThan failed: ${error.message}`);
  return (data?.length ?? 0);
}

// ============================================================================
// 청크 + 임베딩
// ============================================================================

export async function insertChunks(chunks: RagChunkInsert[]): Promise<void> {
  if (chunks.length === 0) return;
  const sb = createServerClient();

  // Supabase에서 vector 타입은 배열을 그대로 받음
  const { error } = await sb.from("rag_chunks").insert(chunks);
  if (error) throw new Error(`insertChunks failed: ${error.message}`);
}

/**
 * 벡터 검색 (RPC 함수 호출)
 */
export async function searchSimilarChunks(params: {
  queryEmbedding: number[];
  matchCount?: number;
  similarityThreshold?: number;
  filterMinistries?: string[];
}): Promise<MatchedChunk[]> {
  const sb = createServerClient();
  const { data, error } = await sb.rpc("match_rag_chunks", {
    query_embedding: params.queryEmbedding,
    match_count: params.matchCount ?? 5,
    similarity_threshold: params.similarityThreshold ?? 0.5,
    filter_ministries: params.filterMinistries ?? null,
  });

  if (error) throw new Error(`searchSimilarChunks failed: ${error.message}`);
  return (data as MatchedChunk[]) ?? [];
}

// ============================================================================
// 동기화 로그
// ============================================================================

export async function startSyncLog(sourceId: string): Promise<string> {
  const sb = createServerClient();
  const id = `sync_${nanoid(10)}`;
  const { error } = await sb.from("rag_sync_logs").insert({
    id,
    source_id: sourceId,
    started_at: Date.now(),
    status: "running",
    fetched_count: 0,
    new_count: 0,
    embedded_count: 0,
  });

  if (error) throw new Error(`startSyncLog failed: ${error.message}`);
  return id;
}

export async function finishSyncLog(
  logId: string,
  result: {
    status: "ok" | "error";
    fetchedCount?: number;
    newCount?: number;
    embeddedCount?: number;
    errorMessage?: string;
  },
): Promise<void> {
  const sb = createServerClient();
  const { error } = await sb
    .from("rag_sync_logs")
    .update({
      finished_at: Date.now(),
      status: result.status,
      fetched_count: result.fetchedCount ?? 0,
      new_count: result.newCount ?? 0,
      embedded_count: result.embeddedCount ?? 0,
      error_message: result.errorMessage ?? null,
    })
    .eq("id", logId);

  if (error) throw new Error(`finishSyncLog failed: ${error.message}`);
}

export async function getRecentSyncLogs(limit = 20) {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("rag_sync_logs")
    .select("*, rss_sources(name, category)")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentSyncLogs failed: ${error.message}`);
  return data ?? [];
}
