-- ============================================================
-- Speech Writer - Supabase 초기 스키마 (PostgreSQL)
-- ============================================================
-- Supabase 대시보드의 SQL Editor에서 이 파일 전체를 한 번에 실행
-- ============================================================

-- 사용자 세션 (MVP는 익명, 부처 도입 시 SSO 추가)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  organization TEXT,
  created_at BIGINT NOT NULL,
  last_active_at BIGINT NOT NULL
);

-- 초안 (생성 결과)
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date TEXT,
  event_location TEXT,
  event_type TEXT NOT NULL,
  speaker_role TEXT NOT NULL,
  speaker_organization TEXT,
  audience TEXT NOT NULL,
  length_option TEXT NOT NULL,
  target_chars INTEGER NOT NULL,
  input_data TEXT NOT NULL,
  has_event_plan INTEGER DEFAULT 0,
  reference_count INTEGER DEFAULT 0,
  draft_md TEXT,
  draft_meta TEXT,
  status TEXT DEFAULT 'draft',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drafts_session ON drafts(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_event_type ON drafts(event_type);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);

-- 작성 이력 (편집 단계별 버전)
CREATE TABLE IF NOT EXISTS draft_revisions (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  draft_md TEXT NOT NULL,
  edit_note TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revisions_draft ON draft_revisions(draft_id, version);

-- 페르소나 사전
CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  role_key TEXT UNIQUE NOT NULL,
  role_label TEXT NOT NULL,
  description TEXT,
  formality_level INTEGER NOT NULL CHECK (formality_level BETWEEN 1 AND 5),
  hanja_ratio_target REAL CHECK (hanja_ratio_target BETWEEN 0 AND 1),
  attributes TEXT,
  created_at BIGINT NOT NULL
);

-- 업로드 파일 메타
CREATE TABLE IF NOT EXISTS uploaded_files (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  draft_id TEXT REFERENCES drafts(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  char_count INTEGER,
  detected_category TEXT,
  category_confidence REAL,
  extracted_stats TEXT,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_session ON uploaded_files(session_id);
CREATE INDEX IF NOT EXISTS idx_files_draft ON uploaded_files(draft_id);
CREATE INDEX IF NOT EXISTS idx_files_expires ON uploaded_files(expires_at);

-- RAG 컨텍스트 캐시 (Cloudflare KV 대체)
CREATE TABLE IF NOT EXISTS rag_contexts (
  cache_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_session ON rag_contexts(session_id);
CREATE INDEX IF NOT EXISTS idx_rag_expires ON rag_contexts(expires_at);

-- 프롬프트 캐시
CREATE TABLE IF NOT EXISTS prompt_cache (
  hash TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_expires ON prompt_cache(expires_at);

-- ============================================================
-- 초기 데이터: 페르소나 사전
-- ============================================================
INSERT INTO personas (id, role_key, role_label, description, formality_level, hanja_ratio_target, attributes, created_at) VALUES
  ('p_minister', 'minister', '장관', '국가 부처를 대표하는 장관급. 격식 매우 높음, 정책 의지 표명이 중심.', 5, 0.45,
    '{"tone":"엄정·결연","frequent_phrases":["굳건히","흔들림 없이","온 힘을 다해"],"avoid_phrases":["~인 것 같습니다"]}',
    EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),

  ('p_vice_minister', 'vice_minister', '차관', '장관 다음 직급. 격식 높음, 실무·정책 균형 잡힌 톤.', 4, 0.42,
    '{"tone":"안정·균형","frequent_phrases":["차질없이","철저히 준비"],"avoid_phrases":[]}',
    EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),

  ('p_director_general', 'director_general', '실장·국장', '본부장·실장·국장급. 정책 전문성 강조, 격식 보통.', 4, 0.40,
    '{"tone":"전문·신뢰","frequent_phrases":["체계적으로","내실 있게"],"avoid_phrases":[]}',
    EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),

  ('p_director', 'director', '과장·팀장', '실무 책임자. 격식 보통, 친근감과 전문성의 균형.', 3, 0.35,
    '{"tone":"친근·실무","frequent_phrases":["함께","꾸준히"],"avoid_phrases":["거시적으로"]}',
    EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),

  ('p_head_of_org', 'head_of_org', '기관장 (시장·도지사·이사장 등)', '지자체장·공공기관장. 지역·기관 정체성 강조.', 4, 0.40,
    '{"tone":"포용·비전","frequent_phrases":["우리 ○○","함께 만들어가는"],"avoid_phrases":[]}',
    EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),

  ('p_custom', 'custom', '직접 입력', '사용자가 직접 직급명·페르소나 설정', 3, 0.35,
    '{"tone":"사용자 정의","frequent_phrases":[],"avoid_phrases":[]}',
    EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (role_key) DO NOTHING;

-- ============================================================
-- 안내: Supabase Storage 버킷도 만들어야 함
-- 대시보드에서 Storage → Create bucket → 이름: "uploads", Public: false
-- ============================================================
