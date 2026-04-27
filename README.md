# Speech Writer

> **AI 기반 공공 콘텐츠 작성 도구**
> Phase 1: 말씀자료 (축사·기념사 등 8종) · Phase 2: 보도자료

부처·기관·민간 모두 사용 가능한 범용 도구. 행사 정보를 입력하면 부처 표준 6단 구조로 격식 있는 초안을 5분 안에 자동 생성합니다.

---

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트 | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui |
| 배포 | **Vercel** (자동 빌드·배포) |
| DB | **Supabase PostgreSQL** |
| 파일 | **Supabase Storage** |
| 캐시·세션 | **Supabase 테이블** (RAG 컨텍스트·프롬프트 캐시) |
| AI | Anthropic Claude / Google Gemini / OpenAI GPT (사용자 키 직접 입력) |
| 폼 검증 | React Hook Form + Zod |

**모두 무료 티어로 시작 가능 (카드 등록 불필요)**

---

## 첫 셋업 (15분)

### 1. 사전 준비

- [ ] Node.js 18.18+ 설치 ([nodejs.org](https://nodejs.org))
- [ ] GitHub 계정 (이미 있음)
- [ ] Vercel 계정 ([vercel.com](https://vercel.com), 카드 등록 불필요)
- [ ] Supabase 계정 ([supabase.com](https://supabase.com), 카드 등록 불필요)
- [ ] AI API 키 (사용자가 브라우저에서 직접 입력 — 서버 등록 불필요)

### 2. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 가입 → **New project**
2. 입력값:
   - **Name**: `speech-writer`
   - **Database Password**: 안전하게 보관
   - **Region**: `Northeast Asia (Seoul)`
3. **Create new project** → 1~2분 대기

### 3. DB 스키마 생성

1. Supabase 대시보드 좌측 → **SQL Editor**
2. **New query** 클릭
3. `supabase/init.sql` 파일 전체 내용 복사 → 붙여넣기
4. **Run** 또는 Ctrl+Enter

→ 7개 테이블 + 페르소나 6종 자동 생성

### 4. Storage 버킷 생성

1. Supabase 대시보드 좌측 → **Storage**
2. **New bucket** 클릭
3. 입력값:
   - **Name**: `uploads`
   - **Public**: ❌ (비공개)
4. **Create bucket**

### 5. API 키 복사

1. Supabase 대시보드 좌측 → **Project Settings** (⚙️) → **API**
2. 다음 3개 값 복사:
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **anon public** key (`eyJh...`)
   - **service_role** key (`eyJh...`, 절대 노출 금지)

### 6. GitHub 저장소 만들기

이미 있으시면 건너뛰기. 없다면 [github.com/new](https://github.com/new)에서 `speech-writer` 저장소 생성 후 코드 push.

### 7. Vercel 연동·배포

1. [vercel.com](https://vercel.com) 가입 (GitHub로)
2. **Add New** → **Project**
3. GitHub 저장소 `speech-writer` 선택 → **Import**
4. **Environment Variables** 섹션에서 5단계의 3개 값 입력:

| Variable name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | (Project URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon public key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (service_role key) |

5. **Deploy** 클릭 → 2~5분 대기

→ `speech-writer.vercel.app` 같은 주소로 자동 배포 완료

---

## 로컬 개발 (선택)

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.local.example .env.local
# .env.local에 Supabase 키 3개 입력

# 개발 서버 실행
npm run dev
```

브라우저: [http://localhost:3000](http://localhost:3000)

---

## 사용 방법

1. 인터넷 주소로 접속 (예: `speech-writer.vercel.app`)
2. **API 키 설정** → 본인의 Claude/Gemini/GPT 키 입력 → 검증
3. **말씀자료 작성하기** → 행사 정보 입력 → AI 생성

API 키는 본인 브라우저에만 저장되며 서버에 저장되지 않습니다.

---

## 프로젝트 구조

```
speech-writer/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 홈
│   │   ├── settings/page.tsx     # API 키 설정
│   │   ├── speech/page.tsx       # 말씀자료 작성
│   │   └── api/
│   │       ├── session/          # 세션 발급
│   │       ├── upload/           # 파일 업로드
│   │       ├── contexts/         # RAG 컨텍스트 조회
│   │       ├── extract-event-info/  # 행사정보 자동 추출
│   │       ├── classify-reference/  # 참고자료 자동 분류
│   │       └── validate-key/     # API 키 유효성 검증
│   ├── components/
│   │   ├── api-key-banner.tsx    # API 키 상태 배너
│   │   ├── speech/               # 말씀자료 폼
│   │   ├── upload/               # 파일 업로드 UI
│   │   └── ui/                   # shadcn/ui
│   └── lib/
│       ├── supabase/             # Supabase 클라이언트
│       ├── llm/                  # 멀티 LLM 통합 클라이언트
│       ├── hooks/                # React 훅
│       ├── data/                 # 정적 데이터
│       ├── extractors/           # 파일 텍스트 추출
│       ├── schemas/              # Zod 스키마
│       ├── db.ts                 # DB 헬퍼
│       ├── storage.ts            # Storage 헬퍼
│       └── rag-cache.ts          # RAG 캐시
├── supabase/
│   └── init.sql                  # 초기 스키마
├── docs/                         # 프로젝트 문서
├── .env.local.example
├── next.config.js
└── package.json
```

---

## 무료 티어 한도

| 자원 | 무료 한도 | MVP 영향 |
|---|---|---|
| Vercel | 월 100GB 트래픽, 1M 함수 호출 | 충분 |
| Supabase | 500MB DB, 1GB Storage | 초기 1년 충분 |
| AI API | 사용자 본인 키, 본인 한도 | 사용자별 |

→ MVP 운영 비용 0원

---

## 차수별 진행 계획

| 차수 | 작업 | 상태 |
|---|---|---|
| 1 | 골격 + 화면 1·2-B | ✅ 완료 |
| 2 | 행사계획서·참고자료 업로드 | ✅ 완료 |
| 2.5 | 멀티 LLM 키 입력 (v0.2) | ✅ 완료 |
| 3 | Vercel + Supabase 전환 (v0.3) | ✅ 완료 |
| **4** | **AI 본문 생성 + 결과 편집 (v0.4)** | **✅ 현재** |
| 5 | 이력 화면 (작성 내역 목록·검색) | 다음 |
| 6 | 페르소나 커스터마이징·고급 기능 | |

---

## 변경 이력

자세한 내용은 [CHANGELOG.md](CHANGELOG.md) 참조.

**v0.4 (2026-04-27)**: AI 본문 생성 (5-Layer 프롬프트) + 결과 편집·복사
**v0.3 (2026-04-27)**: Cloudflare → Vercel + Supabase 전환
**v0.2 (2026-04-27)**: 멀티 LLM 키 입력 기능 추가
**v0.1**: 초기 골격 (Cloudflare 기반)
