/**
 * Supabase DB 헬퍼
 *
 * 기존 Cloudflare D1 헬퍼와 동일한 함수 시그니처를 유지하여
 * 다른 코드 수정 없이 인프라만 교체 가능하도록 설계.
 */

import { nanoid } from "nanoid";
import { createServerClient } from "./supabase/server";

// ============================================================
// Types (Supabase row 형태)
// ============================================================

export interface SessionRow {
  id: string;
  display_name: string | null;
  organization: string | null;
  created_at: number; // unix epoch ms
  last_active_at: number;
}

export interface DraftRow {
  id: string;
  session_id: string;
  event_name: string;
  event_date: string | null;
  event_location: string | null;
  event_type: string;
  speaker_role: string;
  speaker_organization: string | null;
  audience: string; // JSON string
  length_option: string;
  target_chars: number;
  input_data: string;
  has_event_plan: number;
  reference_count: number;
  draft_md: string | null;
  draft_meta: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface UploadedFileRow {
  id: string;
  session_id: string;
  draft_id: string | null;
  file_name: string;
  file_type: string;
  storage_key: string;
  char_count: number | null;
  detected_category: string | null;
  category_confidence: number | null;
  extracted_stats: string | null;
  expires_at: number;
  created_at: number;
}

// ============================================================
// Sessions
// ============================================================

export async function createSession(
  displayName?: string,
  organization?: string,
): Promise<SessionRow> {
  const sb = createServerClient();
  const id = `s_${nanoid(12)}`;
  const now = Date.now();

  const row = {
    id,
    display_name: displayName ?? null,
    organization: organization ?? null,
    created_at: now,
    last_active_at: now,
  };

  const { error } = await sb.from("sessions").insert(row);
  if (error) throw new Error(`createSession failed: ${error.message}`);

  return row;
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getSession failed: ${error.message}`);
  return (data as SessionRow | null) ?? null;
}

export async function touchSession(id: string): Promise<void> {
  const sb = createServerClient();
  await sb
    .from("sessions")
    .update({ last_active_at: Date.now() })
    .eq("id", id);
}

// ============================================================
// Drafts
// ============================================================

export async function createDraft(
  draft: Omit<DraftRow, "id" | "created_at" | "updated_at">,
): Promise<DraftRow> {
  const sb = createServerClient();
  const id = `d_${nanoid(12)}`;
  const now = Date.now();
  const row: DraftRow = { ...draft, id, created_at: now, updated_at: now };

  const { error } = await sb.from("drafts").insert(row);
  if (error) throw new Error(`createDraft failed: ${error.message}`);

  return row;
}

export async function getDraft(id: string): Promise<DraftRow | null> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("drafts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getDraft failed: ${error.message}`);
  return (data as DraftRow | null) ?? null;
}

export async function listDraftsBySession(
  sessionId: string,
  limit = 20,
): Promise<DraftRow[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("drafts")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listDraftsBySession failed: ${error.message}`);
  return (data as DraftRow[]) ?? [];
}

// ============================================================
// Uploaded Files
// ============================================================

export async function createUploadedFile(
  file: Omit<UploadedFileRow, "id" | "created_at">,
): Promise<UploadedFileRow> {
  const sb = createServerClient();
  const id = `f_${nanoid(12)}`;
  const now = Date.now();
  const row: UploadedFileRow = { ...file, id, created_at: now };

  const { error } = await sb.from("uploaded_files").insert(row);
  if (error) throw new Error(`createUploadedFile failed: ${error.message}`);

  return row;
}

export async function getUploadedFile(
  id: string,
): Promise<UploadedFileRow | null> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("uploaded_files")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getUploadedFile failed: ${error.message}`);
  return (data as UploadedFileRow | null) ?? null;
}
