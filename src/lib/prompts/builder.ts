/**
 * 5-Layer 프롬프트 빌더
 *
 * L1~L3은 정적, L4(컨텍스트)와 L5(사용자 입력)는 동적으로 생성.
 * 최종 시스템 프롬프트와 사용자 프롬프트를 조립.
 */

import { L1_SYSTEM_IDENTITY } from "./l1-identity";
import { L2_DOMAIN_KNOWLEDGE } from "./l2-domain";
import { L3_COMPOSITION_RULES } from "./l3-rules";
import type { RagContext } from "../rag-cache";

export interface SpeechGenerationInput {
  // 행사 정보
  eventName: string;
  eventDate?: string;
  eventLocation?: string;
  eventType: string; // chuksa, gyenyeomsa, sinnyeonsa, gyeokryeosa, hwanyeongsa, gaehyesa, iimsa, seomyeonchuksa
  eventTypeLabel?: string; // 한글 라벨

  // 발화자
  speakerRole: string; // minister, vice_minister, director_general, director, head_of_org, custom
  speakerRoleLabel?: string;
  speakerRoleCustom?: string;
  speakerOrganization?: string;

  // 청중·분량
  audience: string[];
  lengthOption: string;
  targetChars: number;

  // 핵심 메시지·기타
  keyMessages?: string[];
  citedStats?: string;
  avoidExpressions?: string[];
  attendees?: Array<{ name: string; role: string }>;

  // 컨텍스트 (업로드된 자료)
  contexts?: RagContext[];
}

/**
 * 행사 유형 한글 라벨 매핑 (영문 키 → 한글)
 */
const EVENT_TYPE_LABELS: Record<string, string> = {
  chuksa: "축사",
  gyenyeomsa: "기념사",
  sinnyeonsa: "신년사",
  gyeokryeosa: "격려사",
  hwanyeongsa: "환영사",
  gaehyesa: "개회사",
  iimsa: "이임사",
  seomyeonchuksa: "서면축사",
};

/**
 * 발화자 직급 한글 라벨 매핑
 */
const SPEAKER_ROLE_LABELS: Record<string, string> = {
  minister: "장관",
  vice_minister: "차관",
  director_general: "실장·국장",
  director: "과장·팀장",
  head_of_org: "기관장",
  custom: "직접 입력",
};

/**
 * L4: 컨텍스트 주입 (업로드 자료)
 */
function buildL4Context(input: SpeechGenerationInput): string {
  if (!input.contexts || input.contexts.length === 0) {
    return "# 참고 자료\n\n(업로드된 참고 자료 없음 — 일반적 작성 원칙으로 작성)";
  }

  const planContexts = input.contexts.filter((c) => c.fileType === "plan");
  const referenceContexts = input.contexts.filter(
    (c) => c.fileType === "reference",
  );

  let result = "# 참고 자료\n\n";

  if (planContexts.length > 0) {
    result += "## 행사 계획서\n\n";
    for (const ctx of planContexts) {
      result += `### ${ctx.fileName}\n\n${ctx.text.slice(0, 3000)}\n\n`;
    }
  }

  if (referenceContexts.length > 0) {
    // 분류별 정렬: policy_plan → statistics → previous_speech → bio → other
    const categoryOrder: Record<string, number> = {
      policy_plan: 1,
      statistics: 2,
      previous_speech: 3,
      bio: 4,
      other: 5,
    };
    const sorted = [...referenceContexts].sort(
      (a, b) =>
        (categoryOrder[a.category ?? "other"] ?? 5) -
        (categoryOrder[b.category ?? "other"] ?? 5),
    );

    result += "## 추가 참고 자료\n\n";
    for (const ctx of sorted) {
      const categoryLabel = ctx.category
        ? `[${getCategoryLabel(ctx.category)}]`
        : "";
      result += `### ${categoryLabel} ${ctx.fileName}\n\n${ctx.text.slice(0, 2000)}\n\n`;
    }
  }

  result +=
    "\n**중요**: 위 자료에 명시된 통계·사례·인용만 사용하십시오. 만들어내지 마십시오.";

  return result;
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    policy_plan: "정책 추진계획",
    statistics: "통계·인용",
    previous_speech: "이전 말씀자료",
    bio: "참석자 약력",
    other: "기타",
  };
  return labels[category] ?? category;
}

/**
 * L5: 사용자 입력 (행사 정보 정리)
 */
function buildL5UserInput(input: SpeechGenerationInput): string {
  const eventTypeLabel =
    input.eventTypeLabel ??
    EVENT_TYPE_LABELS[input.eventType] ??
    input.eventType;

  const speakerRoleLabel =
    input.speakerRole === "custom"
      ? (input.speakerRoleCustom ?? "직접 입력")
      : (input.speakerRoleLabel ??
        SPEAKER_ROLE_LABELS[input.speakerRole] ??
        input.speakerRole);

  const today = new Date().toISOString().split("T")[0];

  let result = "# 작성 요청 정보\n\n";

  result += "## 행사 정보\n\n";
  result += `- **행사명**: ${input.eventName}\n`;
  result += `- **행사 유형**: ${eventTypeLabel}\n`;
  if (input.eventDate) result += `- **일시**: ${input.eventDate}\n`;
  if (input.eventLocation) result += `- **장소**: ${input.eventLocation}\n`;

  result += "\n## 발화자\n\n";
  result += `- **직급**: ${speakerRoleLabel}\n`;
  if (input.speakerOrganization)
    result += `- **소속**: ${input.speakerOrganization}\n`;

  result += "\n## 청중\n\n";
  result += `- ${input.audience.join(", ")}\n`;

  if (input.attendees && input.attendees.length > 0) {
    result += "\n## 주요 참석자 (직급 순)\n\n";
    for (const a of input.attendees) {
      result += `- ${a.role} ${a.name}\n`;
    }
  }

  result += "\n## 분량 요청\n\n";
  result += `- **목표 분량**: ${input.lengthOption}\n`;
  result += `- **목표 글자수**: 약 ${input.targetChars}자 (95~105% 범위 준수)\n`;

  if (input.keyMessages && input.keyMessages.length > 0) {
    result += "\n## 핵심 메시지 (반드시 본문에 반영)\n\n";
    input.keyMessages.forEach((msg, i) => {
      result += `${i + 1}. ${msg}\n`;
    });
  }

  if (input.citedStats) {
    result += "\n## 인용할 통계·일화\n\n";
    result += `${input.citedStats}\n`;
  }

  if (input.avoidExpressions && input.avoidExpressions.length > 0) {
    result += "\n## 피해야 할 표현\n\n";
    input.avoidExpressions.forEach((exp) => {
      result += `- ${exp}\n`;
    });
  }

  result += `\n## 작성일\n\n${today}\n`;

  return result;
}

// ============================================================
// 최종 조립
// ============================================================

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  estimatedInputTokens: number;
}

/**
 * 5-Layer 프롬프트를 조립하여 최종 시스템·사용자 프롬프트 생성
 *
 * - System: L1 + L2 + L3 (정적, 동일)
 * - User: L4 + L5 (동적, 사용자별 다름)
 */
export function buildSpeechPrompt(input: SpeechGenerationInput): BuiltPrompt {
  const systemPrompt = [
    L1_SYSTEM_IDENTITY,
    L2_DOMAIN_KNOWLEDGE,
    L3_COMPOSITION_RULES,
  ].join("\n\n---\n\n");

  const l4 = buildL4Context(input);
  const l5 = buildL5UserInput(input);

  const userPrompt = `${l4}\n\n---\n\n${l5}\n\n---\n\n# 작성 시작

위 모든 정보를 바탕으로 ${EVENT_TYPE_LABELS[input.eventType] ?? "말씀자료"}를 작성하십시오. 시스템 프롬프트의 5대 원칙·작성 절차·출력 형식을 모두 준수하여 최종본을 출력하십시오.`;

  // 한국어 기준 1글자 ≈ 1.5 토큰
  const estimatedInputTokens = Math.ceil(
    (systemPrompt.length + userPrompt.length) * 1.5,
  );

  return {
    systemPrompt,
    userPrompt,
    estimatedInputTokens,
  };
}
