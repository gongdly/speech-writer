# Changelog

## v0.5.1 (2026-04-27) — 버그 수정

### 🐛 사용 모델 표시 오류 수정

Gemini 키만 등록해도 화면에는 "Anthropic Claude"로 잘못 표시되던 문제 수정.

#### 원인

`defaultProvider`가 `"anthropic"`으로 고정되어 있어서, 사용자가 다른 provider(Gemini/OpenAI) 키만 등록해도 화면 표시·실제 호출 모두 Anthropic으로 잘못 동작.

#### 수정 사항

- `useLLMSettings` 훅에 `effectiveProvider` 추가 — defaultProvider에 키가 없으면 등록된 첫 번째 provider로 자동 fallback
- `ApiKeyBanner` 컴포넌트가 `effectiveProvider`를 사용해 실제 호출될 provider 정확히 표시
- 자동 전환된 경우 시각적 안내 표시 ("기본 설정 키 없음 → 자동 전환")
- 설정 페이지에서 첫 키 등록 시 해당 provider를 자동으로 default로 설정

---

## v0.5.0 (2026-04-27) — 작성 이력 화면 (차수 5)

### ✨ 작성 이력 조회·재사용 기능

과거에 작성한 모든 초안을 한 화면에서 검색·재사용·삭제할 수 있는 이력 화면.

#### 새 기능

- **이력 화면** (`/history`): 최근 순으로 모든 초안 목록 표시
- **검색**: 행사명 부분일치 검색
- **필터**: 행사 유형(8종)별 필터링
- **재사용**: 과거 입력값을 그대로 가져와 새 초안 작성
- **삭제**: 초안 개별 삭제 (확인 다이얼로그)
- **페이지네이션**: 20건씩 페이지 분할

#### 새 파일

- `src/app/api/history/route.ts` (목록·삭제 API)
- `src/app/api/drafts/[id]/reuse/route.ts` (재사용 데이터 변환 API)
- `src/app/history/page.tsx` (이력 화면)

#### 수정

- `src/app/speech/page.tsx`: `?reuse=draftId` 쿼리 파라미터 처리, 헤더에 이력 링크 추가
- `src/components/speech/speech-form.tsx`: `reuseValues` prop 추가, 폼 자동 채움
- `src/app/page.tsx`: 보조 메뉴 정리 (페르소나 제거, 이력 강조)
- `src/app/result/[draftId]/page.tsx`: 헤더에 이력 링크 추가

---

## v0.4.0 (2026-04-27) — AI 본문 생성 (차수 3)

### ✨ 핵심 기능: AI가 실제 말씀자료 본문을 생성

5-Layer 프롬프트 아키텍처로 6단 정형 구조에 맞는 말씀자료 초안을 자동 생성.

#### 새 기능

- **AI 본문 생성**: 폼 제출 → 5-Layer 프롬프트 조립 → AI 호출 → 마크다운 본문 출력
- **결과 화면**: 생성된 본문을 보고 편집·복사 가능 (`/result/[draftId]`)
- **단순 텍스트 편집**: 결과 화면에서 직접 수정·저장
- **마크다운 복사**: 한 번 클릭으로 클립보드 복사
- **다시 작성**: 작성 페이지로 돌아가기
- **자동 저장**: 생성된 모든 초안이 Supabase `drafts` 테이블에 저장

#### 5-Layer 프롬프트 아키텍처

| Layer | 내용 | 파일 |
|---|---|---|
| L1 | 시스템 정체성 (역할·금지사항·원칙) | `lib/prompts/l1-identity.ts` |
| L2 | 도메인 지식 (6단 구조·8행사·정형구·페르소나) | `lib/prompts/l2-domain.ts` |
| L3 | 작성 규칙 (절차·출력 형식) | `lib/prompts/l3-rules.ts` |
| L4 | 컨텍스트 주입 (업로드 자료 자동 포함) | `lib/prompts/builder.ts` |
| L5 | 사용자 입력 (행사 정보 정리) | `lib/prompts/builder.ts` |

#### 새 파일

- `src/lib/prompts/l1-identity.ts`
- `src/lib/prompts/l2-domain.ts`
- `src/lib/prompts/l3-rules.ts`
- `src/lib/prompts/builder.ts` (5-Layer 조립기)
- `src/app/api/generate-speech/route.ts` (생성 API)
- `src/app/api/drafts/[id]/route.ts` (조회·편집 API)
- `src/app/result/[draftId]/page.tsx` (결과 화면)

#### 수정

- `src/components/speech/speech-form.tsx`: 임시 alert → 실제 API 호출 + 결과 페이지 이동

#### 의도적 제외

- **가드레일 (G-1~G-10)**: 빅보스님 결정에 따라 차수 3에서는 제외. 사용자(공무원) 본인이 검수 가능하고, 모던 LLM이 대부분의 규칙을 자동 준수하므로 불필요. 향후 부처 정식 도입 시 재검토.

#### 비용 안내

생성 1회당 사용자 본인 API 키에서 차감:
- Claude Sonnet 4.6: 약 $0.01~0.05
- Gemini 2.5 Pro: 약 $0.005~0.02
- GPT-5: 약 $0.01~0.04

---

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
