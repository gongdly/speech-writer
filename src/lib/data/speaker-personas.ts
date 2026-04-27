/**
 * 발화자 페르소나 (범용 직급)
 * 행안부·교육부·지자체·공공기관·민간 모두 사용 가능
 *
 * DB의 personas 테이블과 1:1 매칭됨
 */

export type SpeakerRoleKey =
  | "minister"
  | "vice_minister"
  | "director_general"
  | "director"
  | "head_of_org"
  | "custom";

export interface SpeakerPersona {
  key: SpeakerRoleKey;
  label: string;
  description: string;
  formalityLevel: number; // 1~5
  hanjaRatioTarget: number; // 0~1
  tone: string;
  frequentPhrases: string[];
  avoidPhrases: string[];
}

export const SPEAKER_PERSONAS: SpeakerPersona[] = [
  {
    key: "minister",
    label: "장관",
    description: "국가 부처를 대표하는 장관급. 격식 매우 높음, 정책 의지 표명이 중심.",
    formalityLevel: 5,
    hanjaRatioTarget: 0.45,
    tone: "엄정·결연",
    frequentPhrases: ["굳건히", "흔들림 없이", "온 힘을 다해"],
    avoidPhrases: ["~인 것 같습니다"],
  },
  {
    key: "vice_minister",
    label: "차관",
    description: "장관 다음 직급. 격식 높음, 실무·정책 균형 잡힌 톤.",
    formalityLevel: 4,
    hanjaRatioTarget: 0.42,
    tone: "안정·균형",
    frequentPhrases: ["차질없이", "철저히 준비"],
    avoidPhrases: [],
  },
  {
    key: "director_general",
    label: "실장·국장",
    description: "본부장·실장·국장급. 정책 전문성 강조, 격식 보통.",
    formalityLevel: 4,
    hanjaRatioTarget: 0.40,
    tone: "전문·신뢰",
    frequentPhrases: ["체계적으로", "내실 있게"],
    avoidPhrases: [],
  },
  {
    key: "director",
    label: "과장·팀장",
    description: "실무 책임자. 격식 보통, 친근감과 전문성의 균형.",
    formalityLevel: 3,
    hanjaRatioTarget: 0.35,
    tone: "친근·실무",
    frequentPhrases: ["함께", "꾸준히"],
    avoidPhrases: ["거시적으로"],
  },
  {
    key: "head_of_org",
    label: "기관장 (시장·도지사·이사장 등)",
    description: "지자체장·공공기관장. 지역·기관 정체성 강조.",
    formalityLevel: 4,
    hanjaRatioTarget: 0.40,
    tone: "포용·비전",
    frequentPhrases: ["우리 ○○", "함께 만들어가는"],
    avoidPhrases: [],
  },
  {
    key: "custom",
    label: "직접 입력",
    description: "사용자가 직접 직급명·페르소나 설정",
    formalityLevel: 3,
    hanjaRatioTarget: 0.35,
    tone: "사용자 정의",
    frequentPhrases: [],
    avoidPhrases: [],
  },
];

export const SPEAKER_PERSONA_MAP = Object.fromEntries(
  SPEAKER_PERSONAS.map((p) => [p.key, p]),
) as Record<SpeakerRoleKey, SpeakerPersona>;
