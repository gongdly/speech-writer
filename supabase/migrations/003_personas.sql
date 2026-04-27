-- =============================================================================
-- speech-writer v0.6 — 발화자 페르소나 마이그레이션
-- =============================================================================
--
-- 빅보스님 실행 순서:
--   1. Supabase 대시보드 → SQL Editor → New query → 이 파일 전체 붙여넣기 → Run
--
-- 안전성: idempotent — 여러 번 실행해도 안전합니다.
-- =============================================================================

-- 1. 페르소나 테이블
CREATE TABLE IF NOT EXISTS public.personas (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,                   -- 예: "○○ 장관님", "기획조정실장님"
  organization  TEXT,                            -- 소속 (예: "행정안전부")
  role          TEXT,                            -- 직급/직책 (예: "장관", "차관", "국장")

  -- 말투·톤
  tone          TEXT NOT NULL DEFAULT 'formal',  -- 'formal' | 'friendly' | 'data_driven' | 'visionary' | 'mixed'
  speech_style  TEXT NOT NULL DEFAULT 'eumsche', -- 'eumsche'(음슴체) | 'gyeoksik'(격식체) | 'mixed'

  -- 표현 사전
  preferred_phrases  JSONB NOT NULL DEFAULT '[]',  -- 자주 쓰는 표현 ["한 마디로", "한 번 더 강조하자면"]
  avoided_phrases    JSONB NOT NULL DEFAULT '[]',  -- 피하는 표현 ["인공지능"] (대체 "AI" 사용)
  preferred_topics   JSONB NOT NULL DEFAULT '[]', -- 즐겨 인용하는 주제 ["통계", "역사적 사례"]

  -- 자유 입력 추가 지시
  custom_instructions TEXT,                       -- 예: "항상 시민 관점에서 시작", "마무리는 다짐으로"

  -- 메타
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  source        TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'auto_extracted'
  source_draft_ids JSONB,                         -- 자동 도출 시 분석에 사용된 draft id 목록
  use_count     INTEGER NOT NULL DEFAULT 0,      -- 사용 횟수 (정렬용)
  last_used_at  BIGINT,
  created_at    BIGINT NOT NULL,
  updated_at    BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_personas_active ON public.personas (is_active);
CREATE INDEX IF NOT EXISTS idx_personas_org ON public.personas (organization);
CREATE INDEX IF NOT EXISTS idx_personas_use ON public.personas (use_count DESC);

-- 2. drafts 테이블에 persona_id 추가 (어떤 페르소나로 작성했는지 추적)
ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS persona_id TEXT REFERENCES public.personas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drafts_persona ON public.drafts (persona_id);

-- 3. 권한 부여
GRANT ALL ON public.personas TO service_role;

-- =============================================================================
-- 검증:
--   SELECT id, name FROM public.personas;
--   → 빈 결과 (0행) 나오면 성공 (페르소나는 사용자가 직접 생성)
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'drafts' AND column_name = 'persona_id';
--   → persona_id 행 나오면 성공
-- =============================================================================
