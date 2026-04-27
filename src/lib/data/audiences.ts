/**
 * 청중 구성 옵션 (다중 선택)
 * 부처·기관·민간 무관 범용 청중 정의
 */

export type AudienceKey =
  | "public_servant"
  | "citizen"
  | "expert"
  | "student"
  | "honoree"
  | "foreign_guest"
  | "industry"
  | "media"
  | "internal_staff"
  | "local_resident";

export interface AudienceOption {
  key: AudienceKey;
  label: string;
  hanjaRatioTarget: number; // 한자어 비율 목표
  formality: number; // 1~5
}

export const AUDIENCE_OPTIONS: AudienceOption[] = [
  { key: "public_servant", label: "공무원", hanjaRatioTarget: 0.45, formality: 4 },
  { key: "citizen", label: "일반 시민", hanjaRatioTarget: 0.30, formality: 3 },
  { key: "expert", label: "전문가·학계", hanjaRatioTarget: 0.50, formality: 4 },
  { key: "student", label: "학생", hanjaRatioTarget: 0.20, formality: 3 },
  { key: "honoree", label: "유공자", hanjaRatioTarget: 0.40, formality: 5 },
  { key: "foreign_guest", label: "외빈", hanjaRatioTarget: 0.30, formality: 5 },
  { key: "industry", label: "산업계", hanjaRatioTarget: 0.40, formality: 4 },
  { key: "media", label: "언론", hanjaRatioTarget: 0.40, formality: 4 },
  { key: "internal_staff", label: "내부 직원", hanjaRatioTarget: 0.35, formality: 3 },
  { key: "local_resident", label: "지역 주민", hanjaRatioTarget: 0.30, formality: 3 },
];

export const AUDIENCE_MAP = Object.fromEntries(
  AUDIENCE_OPTIONS.map((a) => [a.key, a]),
) as Record<AudienceKey, AudienceOption>;
