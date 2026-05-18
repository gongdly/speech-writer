-- =============================================================================
-- speech-writer v0.9.1 — RSS 소스 정리 마이그레이션
-- =============================================================================
--
-- 빅보스님 실행 순서:
--   1. Supabase 대시보드 → SQL Editor → New query → 이 파일 전체 붙여넣기 → Run
--
-- 이 SQL이 하는 일:
--   1. 죽은 RSS 소스 4개 비활성화 (고용노동부·보건복지부·교육부·국토교통부)
--   2. 행안부 RSS URL을 검증된 정확한 주소로 업데이트
--   3. 행안부 설명자료·알립니다 RSS 2개 신규 추가
--
-- 결과: 활성 RSS 소스 4개 (정책브리핑 1 + 행안부 3)
--
-- 안전성: idempotent — 여러 번 실행해도 안전합니다.
-- 데이터 손실: 비활성화된 소스의 과거 article·chunk는 그대로 보존됨 (다만 새 동기화는 안 됨)
-- =============================================================================

-- 1. 죽은 RSS 소스 비활성화 (DELETE가 아닌 비활성화 — 과거 article·chunk 보존)
-- ----------------------------------------------------------------------------
UPDATE public.rss_sources
SET is_active = FALSE,
    last_status = 'deprecated: URL invalid or unverified (2026-05)',
    updated_at = EXTRACT(EPOCH FROM NOW())::bigint * 1000
WHERE id IN ('moel_press', 'mohw_press', 'moe_press', 'molit_press');

-- 2. 행안부 보도자료 RSS URL 교체 (옛 URL → 검증된 URL)
-- ----------------------------------------------------------------------------
UPDATE public.rss_sources
SET rss_url = 'https://www.mois.go.kr/gpms/view/jsp/rss/rss.jsp?ctxCd=1012',
    last_status = NULL,  -- 에러 상태 리셋
    updated_at = EXTRACT(EPOCH FROM NOW())::bigint * 1000
WHERE id = 'mois_press';

-- 3. 행안부 설명자료·알립니다 RSS 신규 추가
-- ----------------------------------------------------------------------------
INSERT INTO public.rss_sources (id, name, category, ministry, rss_url, is_active, created_at, updated_at)
VALUES
  ('mois_explain', '행정안전부 설명자료', 'ministry_press', '행정안전부',
   'https://www.mois.go.kr/gpms/view/jsp/rss/rss.jsp?ctxCd=1013',
   TRUE,
   EXTRACT(EPOCH FROM NOW())::bigint * 1000,
   EXTRACT(EPOCH FROM NOW())::bigint * 1000),

  ('mois_notice', '행정안전부 알립니다', 'ministry_press', '행정안전부',
   'https://www.mois.go.kr/gpms/view/jsp/rss/rss.jsp?ctxCd=1001',
   TRUE,
   EXTRACT(EPOCH FROM NOW())::bigint * 1000,
   EXTRACT(EPOCH FROM NOW())::bigint * 1000)
ON CONFLICT (id) DO UPDATE
SET rss_url = EXCLUDED.rss_url,
    is_active = TRUE,
    updated_at = EXTRACT(EPOCH FROM NOW())::bigint * 1000;

-- 4. 정책브리핑 상태 리셋 (이전 fetch failed 에러 상태 해제)
-- ----------------------------------------------------------------------------
UPDATE public.rss_sources
SET last_status = NULL,
    updated_at = EXTRACT(EPOCH FROM NOW())::bigint * 1000
WHERE id = 'policy_briefing_main';

-- =============================================================================
-- 검증
-- =============================================================================
-- 실행 후 다음 쿼리로 결과 확인:
--
-- SELECT id, name, rss_url, is_active, last_status FROM public.rss_sources ORDER BY is_active DESC, id;
--
-- 예상 결과 (활성 4개 + 비활성 4개):
--   ✅ policy_briefing_main | 정책브리핑 - 정책뉴스       | https://www.korea.kr/...      | true
--   ✅ mois_press           | 행정안전부 보도자료         | .../ctxCd=1012                | true
--   ✅ mois_explain         | 행정안전부 설명자료         | .../ctxCd=1013                | true
--   ✅ mois_notice          | 행정안전부 알립니다         | .../ctxCd=1001                | true
--   ⛔ moel_press           | 고용노동부 보도자료         | (옛 URL)                       | false
--   ⛔ mohw_press           | 보건복지부 보도자료         | (옛 URL)                       | false
--   ⛔ moe_press            | 교육부 보도자료             | (옛 URL)                       | false
--   ⛔ molit_press          | 국토교통부 보도자료         | (옛 URL)                       | false
-- =============================================================================
