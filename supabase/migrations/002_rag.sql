-- =============================================================================
-- speech-writer v0.8 — RAG (정책브리핑 + 부처별 보도자료) 마이그레이션
-- =============================================================================
--
-- 빅보스님 실행 순서:
--   1. Supabase 대시보드 → SQL Editor → 새 쿼리 → 이 파일 전체 붙여넣기 → Run
--   2. (선택) Database → Extensions에서 vector가 ON인지 확인
--
-- 안전성: 이 스크립트는 idempotent — 여러 번 실행해도 안전합니다.
-- =============================================================================

-- 1. pgvector extension 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. RSS 소스 마스터 테이블 (어떤 URL을 동기화할지 관리)
CREATE TABLE IF NOT EXISTS rss_sources (
  id          TEXT PRIMARY KEY,           -- 예: 'policy_briefing', 'mois_press'
  name        TEXT NOT NULL,              -- 예: '정책브리핑', '행정안전부 보도자료'
  category    TEXT NOT NULL,              -- 'policy_briefing' | 'ministry_press'
  ministry    TEXT,                       -- 부처명 (보도자료인 경우)
  rss_url     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at  BIGINT,                 -- Unix ms
  last_status     TEXT,                   -- 'ok' | 'error: 메시지'
  total_articles  INTEGER NOT NULL DEFAULT 0,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rss_sources_category ON rss_sources (category);
CREATE INDEX IF NOT EXISTS idx_rss_sources_ministry ON rss_sources (ministry);
CREATE INDEX IF NOT EXISTS idx_rss_sources_active ON rss_sources (is_active);

-- 3. 원본 기사 테이블 (RSS에서 가져온 원본)
CREATE TABLE IF NOT EXISTS rag_articles (
  id            TEXT PRIMARY KEY,
  source_id     TEXT NOT NULL REFERENCES rss_sources(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  link          TEXT NOT NULL,
  pub_date      BIGINT,                   -- Unix ms (RSS pubDate)
  content       TEXT,                     -- 본문 (description 또는 fetch한 내용)
  description   TEXT,                     -- RSS description (요약)
  ministry      TEXT,                     -- 부처명 (보도자료인 경우)
  guid          TEXT UNIQUE,              -- RSS guid 또는 link (중복 방지)
  created_at    BIGINT NOT NULL,
  updated_at    BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_articles_source ON rag_articles (source_id);
CREATE INDEX IF NOT EXISTS idx_rag_articles_pub_date ON rag_articles (pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_rag_articles_ministry ON rag_articles (ministry);
CREATE INDEX IF NOT EXISTS idx_rag_articles_guid ON rag_articles (guid);

-- 4. 청크 + 임베딩 테이블 (실제 벡터 검색 대상)
-- Gemini gemini-embedding-001 출력 차원: 768 (기본 task type)
CREATE TABLE IF NOT EXISTS rag_chunks (
  id          TEXT PRIMARY KEY,
  article_id  TEXT NOT NULL REFERENCES rag_articles(id) ON DELETE CASCADE,
  chunk_idx   INTEGER NOT NULL,           -- 기사 내 청크 순서 (0부터)
  content     TEXT NOT NULL,              -- 청크 텍스트 (~500자)
  embedding   vector(768),                -- Gemini 임베딩 768차원
  token_count INTEGER,
  created_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_article ON rag_chunks (article_id);

-- 5. 벡터 유사도 인덱스 (HNSW가 IVFFlat보다 정확도 높음, 검색 속도 빠름)
-- 처음에는 데이터가 적어서 인덱스 없이 시퀀셜 스캔이 더 빠름.
-- 청크가 1만 건 이상 쌓이면 인덱스 효율 발생. 일단 만들어 둠.
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding
  ON rag_chunks USING hnsw (embedding vector_cosine_ops);

-- 6. 동기화 로그 테이블 (관찰·디버깅용)
CREATE TABLE IF NOT EXISTS rag_sync_logs (
  id            TEXT PRIMARY KEY,
  source_id     TEXT REFERENCES rss_sources(id) ON DELETE CASCADE,
  started_at    BIGINT NOT NULL,
  finished_at   BIGINT,
  status        TEXT NOT NULL,            -- 'running' | 'ok' | 'error'
  fetched_count INTEGER NOT NULL DEFAULT 0,
  new_count     INTEGER NOT NULL DEFAULT 0,
  embedded_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_rag_sync_logs_source ON rag_sync_logs (source_id);
CREATE INDEX IF NOT EXISTS idx_rag_sync_logs_started ON rag_sync_logs (started_at DESC);

-- =============================================================================
-- 7. 벡터 검색 함수 (코사인 유사도 기반 top-N)
-- =============================================================================
-- 사용 예: SELECT * FROM match_rag_chunks(embedding_vector, 5, 0.7, ARRAY['행정안전부'])
-- - query_embedding: 검색 질의 임베딩
-- - match_count: 반환 개수 (기본 5)
-- - similarity_threshold: 최소 유사도 (0~1, 기본 0.7)
-- - filter_ministries: 부처 필터 (NULL이면 전체)

CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.7,
  filter_ministries text[] DEFAULT NULL
)
RETURNS TABLE (
  chunk_id text,
  article_id text,
  content text,
  similarity float,
  article_title text,
  article_link text,
  article_pub_date bigint,
  article_ministry text,
  source_name text,
  source_category text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id              AS chunk_id,
    c.article_id      AS article_id,
    c.content         AS content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    a.title           AS article_title,
    a.link            AS article_link,
    a.pub_date        AS article_pub_date,
    a.ministry        AS article_ministry,
    s.name            AS source_name,
    s.category        AS source_category
  FROM rag_chunks c
  JOIN rag_articles a ON a.id = c.article_id
  JOIN rss_sources s  ON s.id = a.source_id
  WHERE
    c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
    AND (
      filter_ministries IS NULL
      OR a.ministry = ANY(filter_ministries)
      OR s.category = 'policy_briefing'  -- 정책브리핑은 부처 필터 통과
    )
  ORDER BY c.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- =============================================================================
-- 8. 초기 RSS 소스 데이터 삽입 (idempotent — 이미 있으면 무시)
-- =============================================================================
INSERT INTO rss_sources (id, name, category, ministry, rss_url, created_at, updated_at)
VALUES
  -- 정책브리핑 (부처 무관 통합)
  ('policy_briefing_main', '정책브리핑 - 정책뉴스', 'policy_briefing', NULL,
   'https://www.korea.kr/rss/policy.xml',
   EXTRACT(EPOCH FROM NOW())::bigint * 1000,
   EXTRACT(EPOCH FROM NOW())::bigint * 1000),

  -- 부처별 보도자료 (행안부 계열 우선)
  ('mois_press', '행정안전부 보도자료', 'ministry_press', '행정안전부',
   'https://www.mois.go.kr/rss/cmm/news/news_001.do',
   EXTRACT(EPOCH FROM NOW())::bigint * 1000,
   EXTRACT(EPOCH FROM NOW())::bigint * 1000),

  ('moel_press', '고용노동부 보도자료', 'ministry_press', '고용노동부',
   'https://www.moel.go.kr/rss/news_press.xml',
   EXTRACT(EPOCH FROM NOW())::bigint * 1000,
   EXTRACT(EPOCH FROM NOW())::bigint * 1000),

  ('mohw_press', '보건복지부 보도자료', 'ministry_press', '보건복지부',
   'http://www.mohw.go.kr/rss/news_press.xml',
   EXTRACT(EPOCH FROM NOW())::bigint * 1000,
   EXTRACT(EPOCH FROM NOW())::bigint * 1000),

  ('moe_press', '교육부 보도자료', 'ministry_press', '교육부',
   'https://www.moe.go.kr/boardCnts/rssList.do?boardID=294',
   EXTRACT(EPOCH FROM NOW())::bigint * 1000,
   EXTRACT(EPOCH FROM NOW())::bigint * 1000),

  ('molit_press', '국토교통부 보도자료', 'ministry_press', '국토교통부',
   'http://www.molit.go.kr/rss/news_press.xml',
   EXTRACT(EPOCH FROM NOW())::bigint * 1000,
   EXTRACT(EPOCH FROM NOW())::bigint * 1000)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 9. service_role 권한 (Supabase 새 키 시스템 호환)
-- =============================================================================
GRANT ALL ON rss_sources TO service_role;
GRANT ALL ON rag_articles TO service_role;
GRANT ALL ON rag_chunks TO service_role;
GRANT ALL ON rag_sync_logs TO service_role;
GRANT EXECUTE ON FUNCTION match_rag_chunks TO service_role;

-- =============================================================================
-- 완료. 다음 단계:
--   1. .env에 GEMINI_EMBEDDING_API_KEY 추가 (또는 사용자 등록 키 활용)
--   2. /api/rag/sync 엔드포인트 호출하여 첫 동기화
--   3. Vercel Cron 설정 (매일 새벽 3시)
-- =============================================================================
