import { NextRequest, NextResponse } from "next/server";
import { callLLM, LLMError } from "@/lib/llm/client";
import type { LLMProvider } from "@/lib/llm/types";
import { getDraft, updateDraft } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/adjust-tone
 *
 * 자유 입력 지시로 본문 전체 또는 특정 단의 톤을 조정.
 *
 * Body:
 *   {
 *     draftId: string,
 *     provider: LLMProvider,
 *     model: string,
 *     apiKey: string,
 *     instruction: string,           // 예: "좀 더 따뜻하게", "격식 있게"
 *     scope?: "all" | "section",     // 기본 "all"
 *     sectionNumber?: number,        // scope=section일 때
 *   }
 *
 * Response:
 *   { content: string, charCount: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      draftId: string;
      provider: LLMProvider;
      model: string;
      apiKey: string;
      instruction: string;
      scope?: "all" | "section";
      sectionNumber?: number;
    };

    const {
      draftId,
      provider,
      model,
      apiKey,
      instruction,
      scope = "all",
      sectionNumber,
    } = body;

    if (!draftId || !provider || !model || !apiKey || !instruction?.trim()) {
      return NextResponse.json(
        { error: "필수 필드 누락 (지시 내용 포함)" },
        { status: 400 },
      );
    }

    if (scope === "section" && !sectionNumber) {
      return NextResponse.json(
        { error: "단 단위 톤 조정에는 sectionNumber가 필요합니다" },
        { status: 400 },
      );
    }

    // 초안 조회
    const draft = await getDraft(draftId);
    if (!draft || !draft.draft_md) {
      return NextResponse.json(
        { error: "초안을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    const originalContent = draft.draft_md;

    // 프롬프트 구성
    const systemPrompt = `당신은 한국 정부·공공기관 말씀자료 편집 전문가입니다. 제공된 말씀자료의 **내용·구조·분량은 그대로 유지**하면서, 사용자가 요청한 톤·뉘앙스만 조정합니다.

# 톤 조정 원칙
- 단(段) 구조(## 1단, ## 2단 ...)와 문단 구조를 정확히 유지하세요.
- 정보·사실·통계·인용은 절대 변경하지 마세요.
- 한국 행정문서 형식의 격식은 유지하세요.
- 사용자 지시에 충실하되, 과도한 변형은 피하세요.
- 분량은 원본과 비슷하게 유지하세요 (±10% 이내).

# 출력 형식
- 조정된 ${scope === "all" ? "말씀자료 전체" : `${sectionNumber}단`}를 마크다운으로 출력
- 다른 설명·머리말·꼬리말 없이 본문만 출력하세요.`;

    const userPrompt = `# 행사 정보
- 행사명: ${draft.event_name}
- 행사 유형: ${draft.event_type}
- 발화자: ${draft.speaker_role}

# 사용자 톤 조정 지시
"${instruction.trim()}"

# 원본 ${scope === "all" ? "말씀자료" : `${sectionNumber}단`}
${originalContent}

위 원본의 톤·뉘앙스만 사용자 지시에 맞춰 조정해 주세요. 내용·구조·분량은 유지하세요.`;

    // LLM 호출
    const result = await callLLM({
      provider,
      model,
      apiKey,
      systemPrompt,
      userPrompt,
      maxTokens: 4000,
      temperature: 0.5, // 톤 조정은 안정적으로
    });

    const newContent = result.text.trim();

    // 전체 교체 (단 단위 톤 조정도 일단 전체 교체로 처리하되,
    // 향후 section-parser로 해당 단만 교체하도록 개선 가능)
    let updatedMarkdown: string;
    if (scope === "all") {
      updatedMarkdown = newContent;
    } else {
      // 단 단위 톤 조정 — 향후 정교화
      updatedMarkdown = newContent;
    }

    // DB 저장
    await updateDraft(draftId, updatedMarkdown);

    const charCount = updatedMarkdown.replace(/\s/g, "").length;

    return NextResponse.json({
      content: updatedMarkdown,
      charCount,
    });
  } catch (e) {
    console.error("Adjust tone failed:", e);
    if (e instanceof LLMError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "톤 조정 실패" },
      { status: 500 },
    );
  }
}
