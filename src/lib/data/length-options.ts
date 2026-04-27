/**
 * 5단계 분량 옵션 + 사용자 지정
 */

export type LengthOptionKey =
  | "very_short"
  | "short"
  | "standard"
  | "long"
  | "very_long"
  | "custom";

export interface LengthOption {
  key: LengthOptionKey;
  label: string;
  targetChars: number;
  spokenMinutes: string;
  useCase: string;
  isDefault?: boolean;
  isCustom?: boolean;
}

export const LENGTH_OPTIONS: LengthOption[] = [
  {
    key: "very_short",
    label: "매우 짧게",
    targetChars: 600,
    spokenMinutes: "2분 이내",
    useCase: "간단 인사·환영사",
  },
  {
    key: "short",
    label: "짧게",
    targetChars: 900,
    spokenMinutes: "3분",
    useCase: "영상 축사·짧은 격려사",
  },
  {
    key: "standard",
    label: "표준",
    targetChars: 1500,
    spokenMinutes: "5분",
    useCase: "일반 축사·기념사",
    isDefault: true,
  },
  {
    key: "long",
    label: "길게",
    targetChars: 2400,
    spokenMinutes: "8분",
    useCase: "격식 행사·취임사",
  },
  {
    key: "very_long",
    label: "매우 길게",
    targetChars: 3500,
    spokenMinutes: "12분",
    useCase: "신년사·중요 기념사",
  },
  {
    key: "custom",
    label: "사용자 지정",
    targetChars: 0,
    spokenMinutes: "자동 환산",
    useCase: "특수 상황 (300~5,000자)",
    isCustom: true,
  },
];

export const LENGTH_OPTION_MAP = Object.fromEntries(
  LENGTH_OPTIONS.map((o) => [o.key, o]),
) as Record<LengthOptionKey, LengthOption>;

/**
 * 글자수 → 발화 시간 자동 환산
 * 평균 분당 300자 기준 (한국어 격식 발화)
 */
export function estimateSpokenMinutes(chars: number): string {
  const minutes = Math.round((chars / 300) * 10) / 10;
  if (minutes < 1) return "1분 이내";
  return `약 ${minutes}분`;
}
