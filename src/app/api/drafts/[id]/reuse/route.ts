import { NextRequest, NextResponse } from "next/server";
import { getDraft } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/drafts/[id]/reuse
 *
 * 초안의 입력값을 폼 초기값 형식으로 반환.
 * 사용자가 "이 입력값으로 새로 작성"을 누를 때 사용.
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

    // input_data JSON 파싱
    let inputData: {
      keyMessages?: string[];
      citedStats?: string;
      avoidExpressions?: string[];
      attendees?: Array<{ name: string; role: string }>;
    } = {};
    try {
      inputData = JSON.parse(draft.input_data);
    } catch {
      // 파싱 실패 시 빈 객체
    }

    // audience JSON 파싱
    let audience: string[] = [];
    try {
      audience = JSON.parse(draft.audience);
    } catch {
      audience = [];
    }

    // 분량 옵션 역추정 (target_chars로)
    // 600=very_short, 900=short, 1500=standard, 2400=long, 3500=very_long, 그 외=custom
    const lengthOptionMap: Record<number, string> = {
      600: "very_short",
      900: "short",
      1500: "standard",
      2400: "long",
      3500: "very_long",
    };
    const lengthOption = lengthOptionMap[draft.target_chars] ?? "custom";
    const customChars =
      lengthOption === "custom" ? draft.target_chars : undefined;

    // 폼 초기값 형식으로 변환
    const formValues = {
      eventName: draft.event_name,
      eventDate: draft.event_date ?? "",
      eventLocation: draft.event_location ?? "",
      eventType: draft.event_type,
      speakerRole: draft.speaker_role,
      speakerOrganization: draft.speaker_organization ?? "",
      audience,
      lengthOption,
      customChars,
      keyMessages: inputData.keyMessages ?? [],
      citedStats: inputData.citedStats ?? "",
      avoidExpressions: inputData.avoidExpressions ?? [],
      attendees: inputData.attendees ?? [],
    };

    return NextResponse.json({ formValues });
  } catch (e) {
    console.error("Reuse failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 500 },
    );
  }
}
