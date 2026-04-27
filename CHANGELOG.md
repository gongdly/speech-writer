# Changelog

## v0.8.0 (2026-04-27) — RAG (정책브리핑·보도자료 자동 참고)

말씀자료 작성 시 관련 정책브리핑·부처 보도자료를 자동으로 검색해 컨텍스트로 주입.

### 🚀 새 기능

#### RAG 자동 적용

말씀자료 생성 버튼 누르면 자동으로:

1. 행사명 + 핵심메시지 + 발화자 소속을 검색 질의로 변환
2. Gemini 임베딩으로 벡터화
3. Supabase pgvector로 유사도 검색 (cosine, top-5)
4. 검색된 자료를 5-Layer 프롬프트의 L4 컨텍스트에 자동 추가
5. 결과 화면 상단에 "참고된 자료 N건" 패널 표시 (펼치면 원문 링크)

발화자 소속이 부처명 포함 시 (예: "행정안전부 ○○과") 해당 부처 보도자료 우선 검색.
정책브리핑은 부처 무관 항상 포함.

#### 데이터 소스

| 종류 | 소스 | 동기화 |
|---|---|---|
| 정책브리핑 | korea.kr 정책뉴스 RSS | 매일 새벽 3시 |
| 행정안전부 | mois.go.kr 보도자료 RSS | 매일 새벽 3시 |
| 고용노동부 | moel.go.kr 보도자료 RSS | 매일 새벽 3시 |
| 보건복지부 | mohw.go.kr 보도자료 RSS | 매일 새벽 3시 |
| 교육부 | moe.go.kr 보도자료 RSS | 매일 새벽 3시 |
| 국토교통부 | molit.go.kr 보도자료 RSS | 매일 새벽 3시 |

추가 부처는 Supabase `rss_sources` 테이블에 직접 INSERT로 확장 가능.

#### RAG 관리 페이지 `/rag`

- RSS 소스별 마지막 동기화 시각·상태·기사 수 확인
- "지금 동기화" 수동 버튼
- 최근 30개 동기화 로그 (성공·실패·신규 건수·청크 수)

### 🔧 기술 변경

**Supabase**
- `pgvector` extension 활성화 필요 (마이그레이션에 포함)
- 신규 테이블 4개: `rss_sources`, `rag_articles`, `rag_chunks`, `rag_sync_logs`
- RPC 함수: `match_rag_chunks(query_embedding, match_count, similarity_threshold, filter_ministries)`
- 벡터 인덱스: HNSW + cosine 유사도 (1만 청크 이상 시 효율 발생)

**임베딩**
- 모델: `gemini-embedding-001`
- 차원: 768
- 비용: 무료 티어 (분당 1천만 토큰, 결제 카드 불필요)
- 청크 크기: 500자, 오버랩 50자, 한국어 문장 경계 우선

**API 신규**
- `POST /api/rag/sync` — RSS 동기화 (Vercel Cron + 수동)
- `POST /api/rag/search` — 단독 검색 (디버깅·향후 인터랙티브용)
- `GET /api/rag/status` — 소스·로그 조회

**Vercel Cron**
- `vercel.json`: `/api/rag/sync` 매일 18:00 UTC (= 한국 03:00) 자동 호출
- 인증: `Authorization: Bearer $CRON_SECRET` (Vercel 자동)

**기존 라우트 변경**
- `/api/generate-speech`: RAG 검색 → 컨텍스트 자동 추가 + `ragSources` 응답 필드
- 결과 페이지: `RagSourcesPanel` 컴포넌트로 출처 표시

### ⚙️ 빅보스님이 배포 시 하실 일

1. **Supabase SQL Editor**에서 `supabase/migrations/002_rag.sql` 실행 (pgvector 활성화 + 테이블 생성)
2. **Vercel 환경변수** 추가:
   - `GEMINI_API_KEY` — RAG 임베딩용 (Cron이 사용)
   - `CRON_SECRET` — 임의 문자열 32자 (Vercel Cron 인증)
3. GitHub push → Vercel 자동 배포
4. 배포 완료 후 `/rag` 페이지 접속해 "지금 동기화" 클릭 (첫 풀로드 1~2분)
5. 다음날 새벽 3시 Cron이 자동으로 새 기사만 추가 가져옴

### 💰 비용

- Gemini 임베딩: **무료** (분당 1천만 토큰, 일 한도 없음)
- Supabase pgvector: **무료** (free tier 500MB DB 안에서 6개 부처 1년치 충분)
- Vercel Cron: **무료** (Hobby 일 1회 한도 안)
- 추가 결제 카드 등록 **불필요**

### 📝 사용 흐름

1. 평소처럼 행사 정보 입력 → "본문 생성" 클릭
2. 백그라운드: RAG 검색 (1~2초 추가) → AI 생성
3. 결과 화면 상단에 "참고된 정책브리핑·보도자료 5건" 칩
4. 클릭하면 펼쳐져 원문 링크·유사도 표시
5. 본문에 인용된 통계·정책명을 원문으로 검증 가능

---

## v0.7.0 (2026-04-27) — 단·문단 재생성 + 톤 조정 (차수 7)

v0.6 페르소나는 미루고 v0.7 다듬기 기능 우선 구현.

### ✨ 새 기능

#### 단(段)·문단 단위 재생성

본문에서 마음에 들지 않는 부분만 골라 다시 작성할 수 있습니다.

- **단 클릭** → 그 단 전체 재생성 ("2단 행사 의의" 통째로 다시)
- **문단 클릭** → 그 문단 1개만 재생성 (정밀 조정)
- **추가 지시** (선택) → "좀 더 짧게", "사례 추가" 등
- 재생성 시 전체 흐름·톤을 LLM에게 컨텍스트로 제공해 일관성 유지

#### 자유 입력 톤 조정

자연어로 톤 변경 지시.

- **예시**: "좀 더 따뜻하게", "격식 있게", "친근하게", "간결하게"
- **적용 범위**: 전체 본문 또는 선택한 단만
- **내용·구조·분량은 유지**, 톤만 조정 (LLM 시스템 프롬프트로 강제)

#### UI 변경

- **사이드 패널** (PC 우측 고정, 모바일은 하단 시트로 자동 전환)
- **본문 단·문단 클릭 가능** — 마우스 호버 시 하이라이트
- 편집 모드 진입 시 패널 자동 비활성

### 🔧 기술 변경

- 새 API: `POST /api/regenerate-section` (단/문단 단위)
- 새 API: `POST /api/adjust-tone` (자유 입력 톤 조정)
- 새 유틸: `lib/utils/section-parser.ts` (마크다운→단/문단 파싱·교체)
- 새 컴포넌트: `components/result/refine-panel.tsx`
- `db.ts`: `updateDraft(id, content)` 함수 추가
- 결과 페이지 레이아웃: max-w-4xl → max-w-7xl, flex 2단 구성

### 📝 사용 흐름

1. 결과 화면에서 본문의 단(또는 문단) 클릭 → 하이라이트
2. 우측 패널에서 "재생성" 또는 "톤 조정" 탭 선택
3. (선택) 추가 지시 입력 → 버튼 클릭
4. 5~15초 대기 → 자동 본문 갱신
5. 만족할 때까지 반복 (각 결과는 자동 저장)

---

## v0.5.2 (2026-04-27) — UI 정리

### 🎨 사용 모델 배너에서 자동 전환 안내 제거

자동 fallback 로직은 그대로 유지하되, 화면에는 현재 사용 중인 모델만 표시.

#### 수정

- `ApiKeyBanner`에서 "기본 설정 키 없음 → 자동 전환" 안내 문구 제거
- 사용자에게 불필요한 정보 노출 줄임

---

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
