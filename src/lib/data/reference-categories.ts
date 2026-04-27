/**
 * 참고자료 자동 분류 5종
 */

export type ReferenceCategoryKey =
  | "policy_plan"
  | "statistics"
  | "previous_speech"
  | "bio"
  | "other";

export interface ReferenceCategory {
  key: ReferenceCategoryKey;
  label: string;
  description: string;
  priority: number; // 1=최고 우선순위
  badge: string;    // UI 뱃지 색상 (Tailwind class)
}

export const REFERENCE_CATEGORIES: ReferenceCategory[] = [
  {
    key: "policy_plan",
    label: "정책 추진계획서",
    description: "정책 배경·내용·일정 등 → 4단 정책 사례에 직접 반영",
    priority: 1,
    badge: "bg-blue-100 text-blue-800",
  },
  {
    key: "statistics",
    label: "통계·인용 자료",
    description: "수치·전문가 발언·사례 → 4·5단 인용구로 활용",
    priority: 2,
    badge: "bg-green-100 text-green-800",
  },
  {
    key: "previous_speech",
    label: "이전 말씀자료",
    description: "톤·표현·정형구 학습용 (직접 인용 안 함)",
    priority: 3,
    badge: "bg-amber-100 text-amber-800",
  },
  {
    key: "bio",
    label: "참석자 약력",
    description: "1단 호명·3단 예우 정밀화",
    priority: 4,
    badge: "bg-purple-100 text-purple-800",
  },
  {
    key: "other",
    label: "기타",
    description: "본문 컨텍스트로만 활용",
    priority: 5,
    badge: "bg-gray-100 text-gray-800",
  },
];

export const REFERENCE_CATEGORY_MAP = Object.fromEntries(
  REFERENCE_CATEGORIES.map((c) => [c.key, c]),
) as Record<ReferenceCategoryKey, ReferenceCategory>;
