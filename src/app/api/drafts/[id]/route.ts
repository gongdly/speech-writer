import { NextRequest, NextResponse } from "next/server";
import { getDraft } from "@/lib/db";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/drafts/[id]
 *
 * 특정 초안 조회 (결과 화면 진입 시)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "id 필수" }, { status: 400 });
  }

  try {
    const draft = await getDraft(id);
    if (!draft) {
      return NextResponse.json({ error: "초안 없음" }, { status: 404 });
    }
    return NextResponse.json({ draft });
  } catch (e) {
    console.error("Get draft failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/drafts/[id]
 *
 * 초안 본문 편집·저장
 *
 * Body: { content: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "id 필수" }, { status: 400 });
  }

  try {
    const { content } = (await req.json()) as { content: string };

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "content는 문자열이어야 합니다" },
        { status: 400 },
      );
    }

    const sb = createServerClient();
    const { error } = await sb
      .from("drafts")
      .update({
        draft_md: content,
        updated_at: Date.now(),
      })
      .eq("id", id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Update draft failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "저장 실패" },
      { status: 500 },
    );
  }
}
