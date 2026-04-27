import { NextRequest, NextResponse } from "next/server";
import {
  listAllPersonas,
  createPersona,
  type PersonaInput,
} from "@/lib/personas/db";

export const runtime = "nodejs";

/**
 * GET /api/personas
 * 모든 페르소나 목록
 */
export async function GET() {
  try {
    const personas = await listAllPersonas();
    return NextResponse.json({ personas });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/personas
 * 페르소나 생성
 *
 * Body: PersonaInput
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PersonaInput;

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "이름은 필수입니다" },
        { status: 400 },
      );
    }
    if (!body.tone || !body.speech_style) {
      return NextResponse.json(
        { error: "톤과 어체는 필수입니다" },
        { status: 400 },
      );
    }

    const persona = await createPersona({
      ...body,
      name: body.name.trim(),
      preferred_phrases: (body.preferred_phrases ?? []).filter((s) => s.trim()),
      avoided_phrases: (body.avoided_phrases ?? []).filter((s) => s.trim()),
      preferred_topics: (body.preferred_topics ?? []).filter((s) => s.trim()),
    });

    return NextResponse.json({ persona });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "생성 실패" },
      { status: 500 },
    );
  }
}
