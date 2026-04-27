import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/history?sessionId=xxx&search=xxx&eventType=xxx&limit=20&offset=0
 *
 * 사용자의 작성 이력 조회 (최근순).
 * 검색·필터·페이지네이션 지원.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const search = req.nextUrl.searchParams.get("search")?.trim();
  const eventType = req.nextUrl.searchParams.get("eventType")?.trim();
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10),
    100,
  );
  const offset = Math.max(
    parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10),
    0,
  );

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId 필수" }, { status: 400 });
  }

  try {
    const sb = createServerClient();

    // 베이스 쿼리
    let query = sb
      .from("drafts")
      .select(
        "id, event_name, event_type, event_date, speaker_role, length_option, target_chars, status, created_at, updated_at",
        { count: "exact" },
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 검색 (행사명 부분일치)
    if (search) {
      query = query.ilike("event_name", `%${search}%`);
    }

    // 행사 유형 필터
    if (eventType && eventType !== "all") {
      query = query.eq("event_type", eventType);
    }

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      drafts: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (e) {
    console.error("List history failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/history?sessionId=xxx&draftId=yyy
 *
 * 특정 초안 삭제 (본인 세션의 것만)
 */
export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const draftId = req.nextUrl.searchParams.get("draftId");

  if (!sessionId || !draftId) {
    return NextResponse.json(
      { error: "sessionId·draftId 필수" },
      { status: 400 },
    );
  }

  try {
    const sb = createServerClient();
    const { error } = await sb
      .from("drafts")
      .delete()
      .eq("id", draftId)
      .eq("session_id", sessionId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete draft failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "삭제 실패" },
      { status: 500 },
    );
  }
}
