/**
 * 페르소나 DB 헬퍼 (Supabase)
 */

import { createServerClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

export type PersonaTone =
  | "formal"
  | "friendly"
  | "data_driven"
  | "visionary"
  | "mixed";

export type SpeechStyle = "eumsche" | "gyeoksik" | "mixed";

export interface Persona {
  id: string;
  name: string;
  organization: string | null;
  role: string | null;
  tone: PersonaTone;
  speech_style: SpeechStyle;
  preferred_phrases: string[];
  avoided_phrases: string[];
  preferred_topics: string[];
  custom_instructions: string | null;
  is_active: boolean;
  source: "manual" | "auto_extracted";
  source_draft_ids: string[] | null;
  use_count: number;
  last_used_at: number | null;
  created_at: number;
  updated_at: number;
}

export type PersonaInput = Omit<
  Persona,
  | "id"
  | "use_count"
  | "last_used_at"
  | "created_at"
  | "updated_at"
  | "is_active"
  | "source"
  | "source_draft_ids"
> & {
  is_active?: boolean;
  source?: "manual" | "auto_extracted";
  source_draft_ids?: string[] | null;
};

/**
 * 활성 페르소나 목록 (use_count 내림차순 → 자주 쓰는 게 위로)
 */
export async function listActivePersonas(): Promise<Persona[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("personas")
    .select("*")
    .eq("is_active", true)
    .order("use_count", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`listActivePersonas failed: ${error.message}`);
  return (data as Persona[]) ?? [];
}

/**
 * 모든 페르소나 (관리 페이지용)
 */
export async function listAllPersonas(): Promise<Persona[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("personas")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`listAllPersonas failed: ${error.message}`);
  return (data as Persona[]) ?? [];
}

export async function getPersona(id: string): Promise<Persona | null> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("personas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getPersona failed: ${error.message}`);
  return (data as Persona | null) ?? null;
}

export async function createPersona(input: PersonaInput): Promise<Persona> {
  const sb = createServerClient();
  const id = `p_${nanoid(12)}`;
  const now = Date.now();

  const row: Persona = {
    id,
    name: input.name,
    organization: input.organization ?? null,
    role: input.role ?? null,
    tone: input.tone,
    speech_style: input.speech_style,
    preferred_phrases: input.preferred_phrases ?? [],
    avoided_phrases: input.avoided_phrases ?? [],
    preferred_topics: input.preferred_topics ?? [],
    custom_instructions: input.custom_instructions ?? null,
    is_active: input.is_active ?? true,
    source: input.source ?? "manual",
    source_draft_ids: input.source_draft_ids ?? null,
    use_count: 0,
    last_used_at: null,
    created_at: now,
    updated_at: now,
  };

  const { error } = await sb.from("personas").insert(row);
  if (error) throw new Error(`createPersona failed: ${error.message}`);

  return row;
}

export async function updatePersona(
  id: string,
  patch: Partial<PersonaInput>,
): Promise<void> {
  const sb = createServerClient();
  const update: Record<string, unknown> = {
    updated_at: Date.now(),
  };

  // undefined가 아닌 필드만 업데이트
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.organization !== undefined) update.organization = patch.organization;
  if (patch.role !== undefined) update.role = patch.role;
  if (patch.tone !== undefined) update.tone = patch.tone;
  if (patch.speech_style !== undefined) update.speech_style = patch.speech_style;
  if (patch.preferred_phrases !== undefined)
    update.preferred_phrases = patch.preferred_phrases;
  if (patch.avoided_phrases !== undefined)
    update.avoided_phrases = patch.avoided_phrases;
  if (patch.preferred_topics !== undefined)
    update.preferred_topics = patch.preferred_topics;
  if (patch.custom_instructions !== undefined)
    update.custom_instructions = patch.custom_instructions;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;

  const { error } = await sb.from("personas").update(update).eq("id", id);
  if (error) throw new Error(`updatePersona failed: ${error.message}`);
}

export async function deletePersona(id: string): Promise<void> {
  const sb = createServerClient();
  const { error } = await sb.from("personas").delete().eq("id", id);
  if (error) throw new Error(`deletePersona failed: ${error.message}`);
}

/**
 * 사용 카운트 증가 (생성 후 호출)
 */
export async function incrementPersonaUsage(id: string): Promise<void> {
  const sb = createServerClient();
  // RPC 없이 단순 SELECT → UPDATE
  const { data, error: e1 } = await sb
    .from("personas")
    .select("use_count")
    .eq("id", id)
    .maybeSingle();

  if (e1 || !data) return; // 페르소나 없어도 무시

  const { error: e2 } = await sb
    .from("personas")
    .update({
      use_count: (data.use_count as number) + 1,
      last_used_at: Date.now(),
      updated_at: Date.now(),
    })
    .eq("id", id);

  if (e2) console.warn(`incrementPersonaUsage failed: ${e2.message}`);
}
