import { NextRequest, NextResponse } from "next/server";
import { createSession, getSession, touchSession } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 세션 발급 또는 조회
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      displayName?: string;
      organization?: string;
    };

    const session = await createSession(body.displayName, body.organization);
    return NextResponse.json({ session });
  } catch (e) {
    console.error("Failed to create session:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "세션 발급 실패" },
      { status: 500 },
    );
  }
}

/**
 * 기존 세션 조회 (last_active_at 갱신)
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "id 파라미터 필요" }, { status: 400 });

  const session = await getSession(id);
  if (!session)
    return NextResponse.json({ error: "세션 없음" }, { status: 404 });

  await touchSession(id);
  return NextResponse.json({ session });
}
