/**
 * 8가지 행사 유형 정의
 * 50건 정책브리핑 RSS 분석으로 검증된 분류 (일치율 79.0%)
 * 부처·기관 무관 범용 적용 가능
 */

export type EventTypeKey =
  | "chuksa"
  | "gyenyeomsa"
  | "sinnyeonsa"
  | "gyeoryeosa"
  | "hwanyeongsa"
  | "gaehoesa"
  | "iimsa"
  | "seomyeonchuksa";

export type StructureType = "six_stage" | "four_stage";

export interface EventType {
  key: EventTypeKey;
  label: string;
  description: string;
  structure: StructureType;
  emphasis: string;
  matchRate?: number; // 50건 분석 일치율
}

export const EVENT_TYPES: EventType[] = [
  {
    key: "chuksa",
    label: "축사",
    description: "외부 행사 격려·축하 발화",
    structure: "six_stage",
    emphasis: "참석자 호명 + 정책 사례",
    matchRate: 0.778,
  },
  {
    key: "gyenyeomsa",
    label: "기념사",
    description: "기념일·기념행사 격식 발화",
    structure: "six_stage",
    emphasis: "역사적 회고 + 유공자 예우",
    matchRate: 0.787,
  },
  {
    key: "sinnyeonsa",
    label: "신년사",
    description: "새해 첫 인사",
    structure: "six_stage",
    emphasis: "격려 비중 높음, 시대 인식 중심",
  },
  {
    key: "gyeoryeosa",
    label: "격려사",
    description: "내부 직원·관계자 격려",
    structure: "six_stage",
    emphasis: "내부 청중 친근감",
    matchRate: 0.773,
  },
  {
    key: "hwanyeongsa",
    label: "환영사",
    description: "외부 손님 환영",
    structure: "six_stage",
    emphasis: "1·2단 호명 비중 높음",
  },
  {
    key: "gaehoesa",
    label: "개회사",
    description: "행사 개시 선언",
    structure: "six_stage",
    emphasis: "2단 행사 의의 비중 높음",
  },
  {
    key: "iimsa",
    label: "이임사",
    description: "재임 종료 발화",
    structure: "six_stage",
    emphasis: "재임 회고 + 감사 표명",
  },
  {
    key: "seomyeonchuksa",
    label: "서면축사",
    description: "인쇄·배포용 (현장 미발화)",
    structure: "four_stage",
    emphasis: "약식 인사 + 정부 의지 + 서명 형식",
    matchRate: 0.45,
  },
];

export const EVENT_TYPE_MAP = Object.fromEntries(
  EVENT_TYPES.map((t) => [t.key, t]),
) as Record<EventTypeKey, EventType>;
