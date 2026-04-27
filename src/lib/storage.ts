/**
 * Supabase Storage 헬퍼
 *
 * Cloudflare R2와 동일한 추상화 레벨로 파일 업로드·조회·삭제.
 * Storage 버킷 이름: "uploads"
 */

import { createServerClient } from "./supabase/server";

const BUCKET = "uploads";

/**
 * 파일을 Supabase Storage에 업로드
 */
export async function putFile(
  storageKey: string,
  file: ArrayBuffer | Buffer | Blob,
  contentType: string,
): Promise<void> {
  const sb = createServerClient();
  const { error } = await sb.storage.from(BUCKET).upload(storageKey, file, {
    contentType,
    upsert: true,
  });

  if (error) throw new Error(`putFile failed: ${error.message}`);
}

/**
 * 파일을 Supabase Storage에서 다운로드
 */
export async function getFile(
  storageKey: string,
): Promise<ArrayBuffer | null> {
  const sb = createServerClient();
  const { data, error } = await sb.storage.from(BUCKET).download(storageKey);

  if (error) {
    if (error.message?.includes("not found")) return null;
    throw new Error(`getFile failed: ${error.message}`);
  }

  return await data.arrayBuffer();
}

/**
 * 파일 삭제
 */
export async function deleteFile(storageKey: string): Promise<void> {
  const sb = createServerClient();
  const { error } = await sb.storage.from(BUCKET).remove([storageKey]);
  if (error) throw new Error(`deleteFile failed: ${error.message}`);
}

/**
 * 파일 메타데이터 조회 (존재 여부 확인용)
 */
export async function fileExists(storageKey: string): Promise<boolean> {
  const sb = createServerClient();
  const { data } = await sb.storage
    .from(BUCKET)
    .list(storageKey.includes("/") ? storageKey.split("/").slice(0, -1).join("/") : "", {
      search: storageKey.split("/").pop(),
    });

  return Boolean(data && data.length > 0);
}
