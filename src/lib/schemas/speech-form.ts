import { z } from "zod";

/**
 * 말씀자료 입력 폼 스키마 (화면 2-B)
 */
export const speechFormSchema = z
  .object({
    // 행사 정보
    eventName: z.string().min(1, "행사명을 입력해주세요").max(100, "100자 이내로 입력해주세요"),
    eventDate: z.string().optional(),
    eventLocation: z.string().max(200).optional(),

    // 발화자
    speakerRole: z.enum([
      "minister",
      "vice_minister",
      "director_general",
      "director",
      "head_of_org",
      "custom",
    ]),
    speakerRoleCustom: z.string().max(50).optional(),
    speakerOrganization: z.string().max(100).optional(),

    // 행사 유형
    eventType: z.enum([
      "chuksa",
      "gyenyeomsa",
      "sinnyeonsa",
      "gyeoryeosa",
      "hwanyeongsa",
      "gaehoesa",
      "iimsa",
      "seomyeonchuksa",
    ]),

    // 청중 (다중)
    audience: z.array(z.string()).min(1, "청중을 1개 이상 선택해주세요").max(5),

    // 분량
    lengthOption: z.enum(["very_short", "short", "standard", "long", "very_long", "custom"]),
    customChars: z.coerce.number().int().optional(),

    // 고급 옵션
    keyMessages: z.array(z.string().max(100)).max(3).default([]),
    citedStats: z.string().max(500).optional(),
    avoidExpressions: z.array(z.string().max(50)).max(5).default([]),
    attendees: z
      .array(
        z.object({
          name: z.string().max(50),
          role: z.string().max(50),
        }),
      )
      .max(10)
      .default([]),
  })
  .refine(
    (data) => {
      if (data.speakerRole === "custom") {
        return data.speakerRoleCustom && data.speakerRoleCustom.length > 0;
      }
      return true;
    },
    { message: "직접 입력 선택 시 직급명을 입력해주세요", path: ["speakerRoleCustom"] },
  )
  .refine(
    (data) => {
      if (data.lengthOption === "custom") {
        return data.customChars && data.customChars >= 300 && data.customChars <= 5000;
      }
      return true;
    },
    {
      message: "사용자 지정 분량은 300~5,000자 사이로 입력해주세요",
      path: ["customChars"],
    },
  );

export type SpeechFormValues = z.infer<typeof speechFormSchema>;

export const DEFAULT_SPEECH_FORM_VALUES: Partial<SpeechFormValues> = {
  eventName: "",
  eventDate: "",
  eventLocation: "",
  speakerRole: "director_general",
  speakerOrganization: "",
  eventType: "chuksa",
  audience: ["public_servant"],
  lengthOption: "standard",
  keyMessages: [],
  avoidExpressions: [],
  attendees: [],
};
