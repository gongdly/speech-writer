-- =============================================================================
-- speech-writer v0.8 — RAG 마이그레이션 (vector 스키마 호환 버전)
-- =============================================================================
--
-- 빅보스님 실행 순서:
--   1. Supabase 대시보드 → SQL Editor → New query → 이 파일 전체 붙여넣기 → Run
--
-- 안전성: idempotent — 여러 번 실행해도 안전합니다.
-- =============================================================================

-- 1. search_path에 vector 스키마 추가 (이번 세션 + 영구)
-- pgvector가 vector 스키마에 설치된 경우 이 설정 없이는 vector 타입을 못 찾음
SET search_path TO public, vector, extensions;

-- DB 전체에 영구 적용 (다른 세션·migration에서도 동작)
ALTER DATABASE postgres SET search_path TO "$user", public, vector, extensions;

-- 2. pgvector extension 확인 (이미 vector 스키마에 활성화되어 있으면 통과)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA vector;

-- 3. RSS 소스 마스터 테이블
CREATE TABLE IF NOT EXISTS public.rss_sources (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  ministry    TEXT,
  rss_url     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at  BIGINT,
  last_status     TEXT,
  total_articles  INTEGER NOT NULL DEFAULT 0,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rss_sources_category ON public.rss_sources (category);
CREATE INDEX IF NOT EXISTS idx_rss_sources_ministry ON public.rss_sources (ministry);
CREATE INDEX IF NOT EXISTS idx_rss_sources_active ON public.rss_sources (is_active);

-- 4. 원본 기사 테이블
CREATE TABLE IF NOT EXISTS public.rag_articles (
  id            TEXT PRIMARY KEY,
  source_id     TEXT NOT NULL REFERENCES public.rss_sources(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  link          TEXT NOT NULL,
  pub_date      BIGINT,
  content       TEXT,
  description   TEXT,
  ministry      TEXT,
  guid          TEXT UNIQUE,
  created_at    BIGINT NOT NULL,
  updated_at    BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_articles_source ON public.rag_articles (source_id);
CREATE INDEX IF NOT EXISTS idx_rag_articles_pub_date ON public.rag_articles (pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_rag_articles_ministry ON public.rag_articles (ministry);
CREATE INDEX IF NOT EXISTS idx_rag_articles_guid ON public.rag_articles (guid);

-- 5. 청크 + 임베딩 테이블
-- vector 타입을 vector.vector(768)로 명시 (search_path 의존 회피)
CREATE TABLE IF NOT EXISTS public.rag_chunks (
  id          TEXT PRIMARY KEY,
  article_id  TEXT NOT NULL REFERENCES public.rag_articles(id) ON DELETE CASCADE,
  chunk_idx   INTEGER NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector.vector(768),
  token_count INTEGER,
  created_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_article ON public.rag_chunks (article_id);

-- 6. 벡터 유사도 인덱스 (HNSW + cosine)
-- vector_cosine_ops 연산자도 vector 스키마에 있으므로 명시
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding
  ON public.rag_chunks USING hnsw (embedding vector.vector_cosine_ops);

-- 7. 동기화 로그 테이블
CREATE TABLE IF NOT EXISTS public.rag_sync_logs (
  id            TEXT PRIMARY KEY,
  source_id     TEXT REFERENCES public.rss_sources(id) ON DELETE CASCADE,
  started_at    BIGINT NOT NULL,
  finished_at   BIGINT,
  status        TEXT NOT NULL,
  fetched_count INTEGER NOT NULL DEFAULT 0,
  new_count     INTEGER NOT NULL DEFAULT 0,
  embedded_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_rag_sync_logs_source ON public.rag_sync_logs (source_id);
CREATE INDEX IF NOT EXISTS idx_rag_sync_logs_started ON public.rag_sync_logs (started_at DESC);

-- =============================================================================
-- 8. 벡터 검색 함수 (search_path를 함수 안에서 명시)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.match_rag_chunks(
  query_embedding vector.vector(768),
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
SET search_path = public, vector, extensions
AS $$
  SELECT
    c.id              AS chunk_id,
    c.article_id      AS article_id,
    c.content         AS content,
    1 - (c.embedding OPERATOR(vector.<=>) query_embedding) AS similarity,
    a.title           AS article_title,
    a.link            AS article_link,
    a.pub_date        AS article_pub_date,
    a.ministry        AS article_ministry,
    s.name            AS source_name,
    s.category        AS source_category
  FROM public.rag_chunks c
  JOIN public.rag_articles a ON a.id = c.article_id
  JOIN public.rss_sources s  ON s.id = a.source_id
  WHERE
    c.embedding IS NOT NULL
    AND (1 - (c.embedding OPERATOR(vector.<=>) query_embedding)) >= similarity_threshold
    AND (
      filter_ministries IS NULL
      OR a.ministry = ANY(filter_ministries)
      OR s.category = 'policy_briefing'
    )
  ORDER BY c.embedding OPERATOR(vector.<=>) query_embedding ASC
  LIMIT match_count;
$$;

-- =============================================================================
-- 9. 초기 RSS 소스 데이터
-- =============================================================================
INSERT INTO public.rss_sources (id, name, category, ministry, rss_url, created_at, updated_at)
VALUES
  ('policy_briefing_main', '정책브리핑 - 정책뉴스', 'policy_briefing', NULL,
   'https://www.korea.kr/rss/policy.xml',
   EXTRACT(EPOCH FROM NOW())::bigint * 1000,
   EXTRACT(EPOCH FROM NOW())::bigint * 1000),

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
-- 10. service_role 권한 부여
-- =============================================================================
GRANT USAGE ON SCHEMA vector TO service_role;
GRANT ALL ON public.rss_sources TO service_role;
GRANT ALL ON public.rag_articles TO service_role;
GRANT ALL ON public.rag_chunks TO service_role;
GRANT ALL ON public.rag_sync_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.match_rag_chunks TO service_role;

-- =============================================================================
-- 검증: 다음 쿼리로 정상 작동 확인 가능
--   SELECT id, name FROM public.rss_sources;
--   → 6개 행이 나오면 성공
-- =============================================================================
