import { NextRequest, NextResponse } from "next/server";
import { callLLM, LLMError } from "@/lib/llm/client";
import type { LLMProvider } from "@/lib/llm/types";
import { listDraftsBySpeaker } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/personas/auto-extract
 *
 * 과거 작성 이력을 분석해 페르소나 후보를 LLM으로 도출.
 *
 * Body:
 *   {
 *     provider: LLMProvider,
 *     model: string,
 *     apiKey: string,
 *     organization?: string,    // 행정안전부, 보건복지부 등
 *     role?: string,            // minister, vice_minister, director_general, ...
 *     minDrafts?: number,       // 최소 분석 건수 (기본 3)
 *   }
 *
 * Response:
 *   {
 *     suggested: {
 *       name, organization, role,
 *       tone, speech_style,
 *       preferred_phrases, avoided_phrases, preferred_topics,
 *       custom_instructions
 *     },
 *     analyzedDraftIds: string[],
 *     analyzedCount: number
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      provider: LLMProvider;
      model: string;
      apiKey: string;
      organization?: string;
      role?: string;
      minDrafts?: number;
    };

    const {
      provider,
      model,
      apiKey,
      organization,
      role,
      minDrafts = 3,
    } = body;

    if (!provider || !model || !apiKey) {
      return NextResponse.json(
        { error: "API 키 설정이 필요합니다" },
        { status: 400 },
      );
    }

    if (!organization && !role) {
      return NextResponse.json(
        { error: "소속 또는 직책 중 하나는 필수입니다" },
        { status: 400 },
      );
    }

    // 과거 draft 조회 (최대 10건, 너무 많으면 토큰 폭증)
    const drafts = await listDraftsBySpeaker({
      organization,
      role,
      limit: 10,
    });

    if (drafts.length < minDrafts) {
      return NextResponse.json(
        {
          error: `분석할 작성 이력이 부족합니다 (최소 ${minDrafts}건 필요, 현재 ${drafts.length}건)`,
          analyzedCount: drafts.length,
        },
        { status: 400 },
      );
    }

    // 분석용 컨텍스트 구성
    const draftsForAnalysis = drafts
      .map((d, idx) => {
        const meta = (() => {
          try {
            return d.draft_meta ? JSON.parse(d.draft_meta) : {};
          } catch {
            return {};
          }
        })();
        return `[작성 이력 ${idx + 1}]
- 행사명: ${d.event_name}
- 행사 유형: ${d.event_type}
- 발화자: ${d.speaker_role}${d.speaker_organization ? ` (${d.speaker_organization})` : ""}
- 분량: ${d.target_chars}자

본문:
${(d.draft_md ?? "").slice(0, 3000)}`;
      })
      .join("\n\n---\n\n");

    const systemPrompt = `당신은 한국 정부·공공기관 말씀자료 분석 전문가입니다. 동일 발화자(또는 동일 직책)의 과거 말씀자료들을 분석해, 그 발화자의 고유한 말투·표현·관심 주제를 추출하여 페르소나로 정리합니다.

# 분석 원칙
- 여러 작성 이력에서 **반복적으로 나타나는** 표현·패턴을 찾으세요. 1회만 등장하는 표현은 페르소나가 아닙니다.
- 일반적인 행정 표현("안녕하십니까", "감사합니다")은 제외하고, 발화자 특유의 표현만 추출하세요.
- 톤·어체는 가장 자주 나타나는 것을 선택하세요.

# 출력 형식 (JSON, 다른 설명 금지)
{
  "name": "발화자 호칭 (예: '○○ 장관님', '기획조정실장님' — 본문에서 추정 가능하면 사용, 아니면 직책+님)",
  "organization": "소속 기관명",
  "role": "직책",
  "tone": "formal | friendly | data_driven | visionary | mixed 중 하나",
  "speech_style": "eumsche | gyeoksik | mixed 중 하나",
  "preferred_phrases": ["반복 등장하는 특유 표현 3~5개"],
  "avoided_phrases": ["분석상 의도적으로 회피한 것으로 보이는 표현 0~3개 (없으면 빈 배열)"],
  "preferred_topics": ["자주 인용·강조하는 주제·관점 3~5개"],
  "custom_instructions": "그 외 작성 시 참고할 특이사항 (1~3문장, 없으면 빈 문자열)"
}`;

    const userPrompt = `다음은 ${organization ?? ""} ${role ?? ""}의 과거 말씀자료 ${drafts.length}건입니다. 이를 분석해 페르소나를 JSON으로 도출해 주세요.

${draftsForAnalysis}`;

    let response;
    try {
      response = await callLLM({
        provider,
        model,
        apiKey,
        systemPrompt,
        userPrompt,
        maxTokens: 1500,
        temperature: 0.3, // 분석은 안정적으로
      });
    } catch (e) {
      if (e instanceof LLMError) {
        return NextResponse.json({ error: e.message }, { status: 500 });
      }
      throw e;
    }

    // JSON 파싱
    let suggested;
    try {
      const text = response.text.trim();
      // 코드블록 제거
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      suggested = JSON.parse(cleaned);
    } catch (e) {
      return NextResponse.json(
        {
          error: "페르소나 분석 결과를 JSON으로 파싱하지 못했습니다",
          rawText: response.text.slice(0, 500),
        },
        { status: 500 },
      );
    }

    // 안전 기본값
    suggested.tone = suggested.tone ?? "formal";
    suggested.speech_style = suggested.speech_style ?? "eumsche";
    suggested.preferred_phrases = Array.isArray(suggested.preferred_phrases)
      ? suggested.preferred_phrases
      : [];
    suggested.avoided_phrases = Array.isArray(suggested.avoided_phrases)
      ? suggested.avoided_phrases
      : [];
    suggested.preferred_topics = Array.isArray(suggested.preferred_topics)
      ? suggested.preferred_topics
      : [];

    return NextResponse.json({
      suggested,
      analyzedDraftIds: drafts.map((d) => d.id),
      analyzedCount: drafts.length,
    });
  } catch (e) {
    console.error("Persona auto-extract failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "자동 도출 실패" },
      { status: 500 },
    );
  }
}
