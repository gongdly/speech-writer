import { NextRequest, NextResponse } from "next/server";
import { callLLM, LLMError } from "@/lib/llm/client";
import type { LLMProvider } from "@/lib/llm/types";
import { getDraft, updateDraft } from "@/lib/db";
import {
  parseMarkdown,
  replaceSection,
  replaceParagraph,
} from "@/lib/utils/section-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/regenerate-section
 *
 * 단(段) 또는 문단 단위 재생성.
 *
 * Body:
 *   {
 *     draftId: string,
 *     provider: LLMProvider,
 *     model: string,
 *     apiKey: string,
 *     scope: "section" | "paragraph",
 *     sectionNumber: number,         // 1, 2, 3...
 *     paragraphIndex?: number,       // scope=paragraph일 때 필수
 *     instruction?: string,          // 사용자 추가 지시 (선택)
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
      scope: "section" | "paragraph";
      sectionNumber: number;
      paragraphIndex?: number;
      instruction?: string;
    };

    const {
      draftId,
      provider,
      model,
      apiKey,
      scope,
      sectionNumber,
      paragraphIndex,
      instruction,
    } = body;

    if (!draftId || !provider || !model || !apiKey || !scope || !sectionNumber) {
      return NextResponse.json(
        { error: "필수 필드 누락" },
        { status: 400 },
      );
    }

    if (scope === "paragraph" && paragraphIndex === undefined) {
      return NextResponse.json(
        { error: "문단 재생성에는 paragraphIndex가 필요합니다" },
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

    // 단·문단 파싱
    const sections = parseMarkdown(draft.draft_md);
    const targetSection = sections.find((s) => s.number === sectionNumber);
    if (!targetSection) {
      return NextResponse.json(
        { error: `${sectionNumber}단을 찾을 수 없습니다` },
        { status: 404 },
      );
    }

    // 재생성 대상 추출
    let originalText: string;
    if (scope === "section") {
      originalText = targetSection.body;
    } else {
      const para = targetSection.paragraphs[paragraphIndex!];
      if (!para) {
        return NextResponse.json(
          { error: "문단을 찾을 수 없습니다" },
          { status: 404 },
        );
      }
      originalText = para.text;
    }

    // 재생성 프롬프트 구성
    const meta = draft.draft_meta ? JSON.parse(draft.draft_meta) : {};
    const eventInfo = `행사명: ${draft.event_name}
행사 유형: ${draft.event_type}
발화자: ${draft.speaker_role}
전체 분량 목표: ${draft.target_chars}자`;

    const fullContext = `# 전체 말씀자료 (참고용)

${draft.draft_md}

# 재생성 대상

이 말씀자료의 **${sectionNumber}단 ${targetSection.title}** ${
      scope === "paragraph" ? `의 ${paragraphIndex! + 1}번째 문단` : ""
    }을 다시 작성해 주세요.`;

    const systemPrompt = `당신은 한국 정부·공공기관 말씀자료 작성 전문가입니다. 제공된 전체 말씀자료의 흐름과 톤을 유지하면서, 지정된 부분만 다시 작성합니다.

# 재생성 원칙
- 전체 말씀자료의 톤과 격식을 그대로 유지하세요.
- 다른 단의 내용과 중복되지 않게 작성하세요.
- 한국 행정문서 형식(음슴체 또는 격식체)을 일관되게 유지하세요.
- 분량은 원본과 비슷하게 유지하되, 자연스러움을 우선하세요.

# 출력 형식
- ${scope === "section" ? `${sectionNumber}단의 본문만 출력 (헤더 "## ${sectionNumber}단 ${targetSection.title}"는 출력하지 마세요)` : "재생성된 문단 텍스트만 출력 (마크다운 헤더·번호 없이)"}
- 다른 설명·머리말·꼬리말 없이 본문만 출력하세요.`;

    const userPrompt = `${eventInfo}

${fullContext}

# 원본 ${scope === "section" ? "단" : "문단"}
${originalText}

${instruction ? `# 사용자 추가 지시\n${instruction}\n` : ""}
위 원본을 참고하되, 표현·구조를 새롭게 다시 작성해 주세요.`;

    // LLM 호출
    const result = await callLLM({
      provider,
      model,
      apiKey,
      systemPrompt,
      userPrompt,
      maxTokens: scope === "section" ? 2000 : 800,
      temperature: 0.8, // 다양성 위해 약간 높임
    });

    const newText = result.text.trim();

    // 본문 교체
    let updatedMarkdown: string;
    if (scope === "section") {
      updatedMarkdown = replaceSection(draft.draft_md, sectionNumber, newText);
    } else {
      updatedMarkdown = replaceParagraph(
        draft.draft_md,
        sectionNumber,
        paragraphIndex!,
        newText,
      );
    }

    // DB 저장
    await updateDraft(draftId, updatedMarkdown);

    const charCount = updatedMarkdown.replace(/\s/g, "").length;

    return NextResponse.json({
      content: updatedMarkdown,
      charCount,
      replacedText: newText,
    });
  } catch (e) {
    console.error("Regenerate failed:", e);
    if (e instanceof LLMError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "재생성 실패" },
      { status: 500 },
    );
  }
}
