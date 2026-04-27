# Changelog

## v0.3.0 (2026-04-27) — 인프라 전환

### 🔄 BREAKING: Cloudflare → Vercel + Supabase

Cloudflare 스택에서 누적된 호환성 문제로 인해 Vercel + Supabase로 전환.

#### 전환 사유

Cloudflare 시도 중 다음 누적 장애 발생:
- `@opennextjs/cloudflare` 의존성 임시 패키지 만료 (`pkg.pr.new` 404)
- `runtime = "edge"` 호환 문제 (OpenNext 패키징 단계 실패)
- D1 SQL Console에서 SQL 13개 따로 실행 필요
- R2 사용을 위한 카드 등록 필수
- Worker 프로젝트의 GitHub 자동 빌드 미연동 (Dashboard 수동 배포만 가능)
- 활성 배포가 옛 코드로 고정되어 GitHub 변경사항 미반영

→ Vercel은 Next.js 네이티브 환경, Supabase는 PostgreSQL + Storage + 표준 SQL을 모두 무료 티어로 제공.

#### 변경 항목

**제거**
- `@opennextjs/cloudflare` 의존성
- `wrangler.toml`
- `cloudflare-env.d.ts`
- `open-next.config.ts`
- `migrations/0001_init.sql` (D1용)
- `src/lib/cf/` 폴더 전체 (env, db, kv, r2)
- 모든 라우트의 `runtime = "edge"`

**추가**
- `@supabase/supabase-js`, `@supabase/ssr` 의존성
- `src/lib/supabase/client.ts` (브라우저 클라이언트)
- `src/lib/supabase/server.ts` (서버 클라이언트, Service Role)
- `src/lib/db.ts` (Supabase DB 헬퍼)
- `src/lib/storage.ts` (Supabase Storage 헬퍼)
- `src/lib/rag-cache.ts` (RAG 컨텍스트 캐시)
- `supabase/init.sql` (초기 스키마, 한 번에 실행 가능)
- `.env.local.example` (Supabase 환경변수)

**수정**
- 6개 API 라우트가 `cf/*` 대신 새 헬퍼 사용
- `next.config.js`에 `serverExternalPackages: ["pdf-parse"]` 추가
- README 셋업 가이드 전면 재작성

#### 보존된 기능 (v0.2 그대로)

- 멀티 LLM 클라이언트 (`src/lib/llm/*`)
- API 키 설정 페이지 (`/settings`)
- API 키 검증 라우트 (`/api/validate-key`)
- 사용자별 localStorage 저장 구조
- 메인 화면·폼 UI

#### 셋업 시간 단축

| 작업 | Cloudflare | Vercel + Supabase |
|---|---|---|
| 인프라 자원 생성 | D1 + KV + R2 (각각 따로) | Supabase 1개 + Storage 1개 |
| DB 스키마 적용 | SQL 13개 따로 실행 | SQL 1번에 실행 |
| 카드 등록 | R2 사용 시 필수 | 불필요 |
| GitHub 자동 빌드 | 별도 설정 필요 | 기본 |
| 예상 셋업 시간 | 1~2시간 | 15분 |

---

## v0.2.0 (2026-04-27) — 멀티 LLM 키 입력

### ✨ 멀티 LLM 지원

API 키를 서버 환경변수에서 사용자별 브라우저 입력 방식으로 전환.

#### 새 기능

- 3종 LLM provider 지원 (Anthropic Claude / Google Gemini / OpenAI GPT)
- 각 provider별 2개 모델 (총 6종)
- `/settings` 페이지: API 키 입력·검증·관리
- 키 마스킹·형식 검증·실시간 유효성 검증
- 키 미설정 안내 배너

#### 새 파일

- `src/lib/llm/types.ts`, `client.ts`, `storage.ts`
- `src/lib/hooks/use-llm-settings.ts`
- `src/app/settings/page.tsx`
- `src/app/api/validate-key/route.ts`
- `src/components/api-key-banner.tsx`

---

## v0.1.5 (2026-04-26) — Cloudflare 전환 시도

- Vercel + Supabase에서 Cloudflare(D1+R2+KV)로 전환 시도
- (v0.3에서 다시 Vercel + Supabase로 회귀)

---

## v0.1.0 (2026-04-25) — 초기 릴리스

- Next.js 15 + Tailwind + shadcn/ui 골격
- 화면 1 (홈), 화면 2-B (말씀자료 입력 폼)
- 8가지 행사 유형, 5단계 분량, 6종 페르소나
- 행사계획서·참고자료 업로드
- AI 행사정보 추출 + 참고자료 자동 분류
