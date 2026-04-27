import { NextRequest, NextResponse } from "next/server";
import { listRagContextsBySession } from "@/lib/rag-cache";
import { createServerClient } from "@/lib/supabase/server";
import { deleteFile } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * GET /api/contexts?sessionId=xxx
 *
 * 세션의 업로드된 자료 목록 (행사계획서 + 참고자료 통합)
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId 필수" }, { status: 400 });
  }

  try {
    const contexts = await listRagContextsBySession(sessionId);

    // 컨텍스트 토큰 추정 (한국어 기준 1글자 ≈ 1.5 토큰)
    const totalChars = contexts.reduce(
      (sum, c) => sum + (c.charCount ?? 0),
      0,
    );
    const estimatedTokens = Math.ceil(totalChars * 1.5);

    return NextResponse.json({
      contexts: contexts.map((c) => ({
        fileId: c.fileId,
        fileName: c.fileName,
        fileType: c.fileType,
        category: c.category,
        charCount: c.charCount,
        extractedStats: c.extractedStats,
        uploadedAt: c.uploadedAt,
      })),
      summary: {
        totalFiles: contexts.length,
        totalChars,
        estimatedTokens,
        // Claude 200K 컨텍스트 기준 안전 범위 (60%)
        isSafe: estimatedTokens < 120000,
      },
    });
  } catch (e) {
    console.error("List contexts failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/contexts?sessionId=xxx&fileId=yyy
 */
export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const fileId = req.nextUrl.searchParams.get("fileId");

  if (!sessionId || !fileId) {
    return NextResponse.json(
      { error: "sessionId·fileId 필수" },
      { status: 400 },
    );
  }

  try {
    const sb = createServerClient();

    // 파일 메타에서 storage_key 조회
    const { data: fileRow, error: selectError } = await sb
      .from("uploaded_files")
      .select("storage_key")
      .eq("id", fileId)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (selectError) throw new Error(selectError.message);
    if (!fileRow) {
      return NextResponse.json({ error: "파일 없음" }, { status: 404 });
    }

    // Supabase Storage 객체 삭제
    await deleteFile((fileRow as { storage_key: string }).storage_key);

    // RAG 컨텍스트 삭제
    await sb
      .from("rag_contexts")
      .delete()
      .eq("cache_key", `ctx:${sessionId}:${fileId}`);

    // 파일 메타 삭제
    await sb
      .from("uploaded_files")
      .delete()
      .eq("id", fileId)
      .eq("session_id", sessionId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "삭제 실패" },
      { status: 500 },
    );
  }
}
