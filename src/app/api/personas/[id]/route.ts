import { NextRequest, NextResponse } from "next/server";
import {
  getPersona,
  updatePersona,
  deletePersona,
  type PersonaInput,
} from "@/lib/personas/db";

export const runtime = "nodejs";

/**
 * GET /api/personas/[id]
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const persona = await getPersona(id);
    if (!persona) {
      return NextResponse.json(
        { error: "페르소나를 찾을 수 없습니다" },
        { status: 404 },
      );
    }
    return NextResponse.json({ persona });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/personas/[id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const patch = (await req.json()) as Partial<PersonaInput>;

    // 배열 필드 정리
    if (patch.preferred_phrases) {
      patch.preferred_phrases = patch.preferred_phrases.filter((s) => s.trim());
    }
    if (patch.avoided_phrases) {
      patch.avoided_phrases = patch.avoided_phrases.filter((s) => s.trim());
    }
    if (patch.preferred_topics) {
      patch.preferred_topics = patch.preferred_topics.filter((s) => s.trim());
    }

    await updatePersona(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "수정 실패" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/personas/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deletePersona(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "삭제 실패" },
      { status: 500 },
    );
  }
}
