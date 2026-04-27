# 기술 스택 (진료후 패턴 기반)

## 한 줄 요약

빅보스님이 진료후(診療後) v0.1에서 사용하신 스택을 그대로 차용. 이미 익숙한 환경이라 진입 장벽 0.

## 전체 스택

```
[Frontend]
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form + Zod (폼 검증)

[Backend]
- Cloudflare Workers (서버리스)
- Cloudflare D1 (SQLite, 메타데이터)
- Cloudflare R2 (파일 스토리지, 임시)
- Cloudflare KV (세션·캐시)

[AI]
- Claude API (Anthropic)
- 모델: claude-sonnet-4 (기본) / claude-opus-4 (정밀 모드, 선택적)

[OCR]
- 미정 (Vision API / Tesseract / 회사 표준 — PoC 후 결정)

[파일 처리]
- HWPX 파싱·생성: 미정 (rhwp / 자체 템플릿 / Pandoc 우회 등 — PoC 후 결정)
- DOCX 파싱: mammoth.js
- PDF 파싱: pdf-parse 또는 pdfjs-dist
- 이미지 OCR: 위 OCR 엔진 결정 후

[배포]
- Cloudflare Pages (프론트)
- Cloudflare Workers (API)
- 도메인: 미정 (말씀자료 도메인 등록 필요)
```

## 진료후와의 차이점

| 항목 | 진료후 | 본 프로젝트 |
|---|---|---|
| 프레임워크 | Next.js 15 + TS + Tailwind + shadcn/ui | 동일 |
| 인프라 | Cloudflare Workers + D1 + R2 | 동일 |
| AI 모델 | Claude API (Vision OCR 포함) | 동일 (Vision OCR은 OCR 엔진 결정 따라) |
| 핵심 기능 | OCR + 의료 정보 분석 | 텍스트 추출 + 6단 구조 생성 |
| 출력 | 마크다운 리포트 | **MD (MVP) → HWPX (v2, 라이브러리 PoC 후 결정)** |
| 결제 | 카카오 AdFit (광고) → ₩4,900/월 (구독) | (정부 도입 시 무료, 외부 사용자 미정) |

## 주요 라이브러리 결정

### 프론트엔드

| 라이브러리 | 용도 | 비고 |
|---|---|---|
| `next` v15 | App Router 기반 | 진료후 동일 |
| `react` v19 | UI | 진료후 동일 |
| `typescript` v5 | 타입 안정성 | 진료후 동일 |
| `tailwindcss` v3 | 스타일링 | 진료후 동일 |
| `@radix-ui/*` | 접근성 컴포넌트 (shadcn/ui 기반) | 진료후 동일 |
| `lucide-react` | 아이콘 | 진료후 동일 |
| `react-hook-form` | 폼 상태 관리 | 진료후 동일 |
| `zod` | 폼 검증 | 진료후 동일 |
| `@dnd-kit/sortable` | 드래그 정렬 (호명할 참석자 IN-21) | **신규** |
| `react-dropzone` | 파일 드롭 (UP-01, UP-02) | **신규** |

### 백엔드

| 라이브러리 | 용도 |
|---|---|
| `wrangler` | Cloudflare Workers 배포 |
| `hono` | Workers용 라우터 (선택) |
| `@anthropic-ai/sdk` | Claude API 클라이언트 |
| `mammoth` | DOCX 파일 파싱 |
| `pdf-parse` 또는 `pdfjs-dist` | PDF 파일 파싱 |
| HWPX 처리 | v2 진입 시 PoC 후 결정 (검토 후보: rhwp / 자체 템플릿 / Pandoc 우회) |
| `nanoid` | ID 생성 |

### 데이터 모델 (D1 SQLite)

```sql
-- 사용자 (간단한 세션 기반, 정식 인증은 부처 도입 시)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  role TEXT DEFAULT 'user',  -- user / admin
  created_at INTEGER
);

-- 초안 (생성 결과)
CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_name TEXT,
  event_type TEXT,  -- 8종 중 1
  speaker_role TEXT,
  audience TEXT,  -- JSON array
  length_option TEXT,  -- 매우짧게/짧게/표준/길게/매우길게/사용자지정
  target_chars INTEGER,
  
  -- 입력
  input_data TEXT,  -- JSON: 행사명·일시·장소·핵심 메시지 등
  
  -- 컨텍스트 (요약만 보관, 원본 텍스트는 KV에)
  has_event_plan BOOLEAN,
  reference_count INTEGER,
  
  -- 결과
  draft_md TEXT,  -- 최종 MD 본문
  draft_meta TEXT,  -- JSON: 단계별 분량·가드레일 결과·생성 시간 등
  
  status TEXT DEFAULT 'draft',  -- draft / final / archived
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 작성 이력 (감사용)
CREATE TABLE draft_revisions (
  id TEXT PRIMARY KEY,
  draft_id TEXT,
  version INTEGER,
  draft_md TEXT,
  edit_note TEXT,  -- 사용자 메모
  created_at INTEGER,
  FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

-- 페르소나 사전 (직급별)
CREATE TABLE personas (
  id TEXT PRIMARY KEY,
  role TEXT,  -- 장관·차관·국장·과장 등
  description TEXT,
  formality_level INTEGER,  -- 1~5
  hanja_ratio_target REAL,  -- 0.0~1.0
  attributes TEXT,  -- JSON: 어조·자주 쓰는 표현 등
  created_at INTEGER
);
```

## R2 / KV 사용 패턴

### R2 (파일 스토리지, 임시)

```
/uploads/{session_id}/{file_id}.{ext}  -- 사용자 업로드 원본 (24h TTL)
/extracts/{session_id}/{file_id}.txt   -- 추출 텍스트 (24h TTL)
```

### KV (세션·캐시)

```
session:{session_id}                    -- 세션 메타 (1h TTL)
context:{session_id}                    -- RAG 컨텍스트 (1h TTL)
prompt-cache:{hash}                     -- 동일 입력 캐시 (24h TTL, 비용 절감)
```

## API 엔드포인트 설계

### 파일 업로드

```
POST /api/upload
  Body: multipart/form-data
    - file: File
    - type: "plan" | "reference"
    - session_id: string
  Response: 
    {
      file_id: string,
      extracted_text_preview: string,
      detected_category: string,  // 참고자료의 경우
      char_count: number
    }
```

### 자료 자동 추출 (행사계획서)

```
POST /api/extract-event-info
  Body: { file_id: string }
  Response:
    {
      event_name: string,
      event_date: string,
      event_location: string,
      attendees: [{ name, role }],
      confidence: number  // 0~1
    }
```

### 초안 생성

```
POST /api/compose
  Body: {
    session_id: string,
    event_name: string,
    event_date: string,
    event_type: string,
    speaker_role: string,
    audience: string[],
    length_option: string,
    target_chars: number,
    key_messages: string[],
    cited_stats: string,
    avoid_expressions: string[],
    attendees: [{ name, role }],
    plan_file_id?: string,
    reference_file_ids: string[]
  }
  Response (Streaming):
    Server-Sent Events
    - chunk: 단계별 본문 청크
    - validation: 가드레일 검증 결과
    - done: 최종 결과 (draft_id, total_chars, validation_summary)
```

### 초안 저장·조회

```
POST /api/drafts          # 저장
GET  /api/drafts          # 목록
GET  /api/drafts/:id      # 상세
PUT  /api/drafts/:id      # 편집 저장
DELETE /api/drafts/:id    # 삭제
```

## 환경 변수

```
# .env.local
ANTHROPIC_API_KEY=sk-...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
D1_DATABASE_ID=...
R2_BUCKET_NAME=mois-speech-uploads
KV_NAMESPACE_ID=...

# 환경 분리
NODE_ENV=development|production
SITE_URL=http://localhost:3000  # 또는 배포 URL
```

## 프로젝트 디렉토리 구조 (권장)

```
/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (home)/             # 화면 1
│   │   ├── speech/             # 화면 2-B
│   │   │   ├── page.tsx
│   │   │   └── upload/         # 화면 2-B-1, 2-B-2
│   │   ├── result/[id]/        # 화면 3
│   │   ├── edit/[id]/          # 화면 4
│   │   └── history/            # 화면 5
│   ├── components/
│   │   ├── ui/                 # shadcn/ui
│   │   ├── speech-form.tsx
│   │   ├── file-upload-zone.tsx
│   │   ├── reference-upload-list.tsx
│   │   └── draft-viewer.tsx
│   ├── lib/
│   │   ├── prompts/            # 5-Layer 프롬프트
│   │   │   ├── l1-identity.ts
│   │   │   ├── l2-domain.ts
│   │   │   ├── l3-rules.ts
│   │   │   ├── l4-context.ts
│   │   │   └── l5-input.ts
│   │   ├── guardrails/         # 가드레일 검증
│   │   ├── extractors/         # 파일별 텍스트 추출
│   │   │   ├── docx.ts
│   │   │   ├── pdf.ts
│   │   │   ├── hwpx.ts
│   │   │   └── image-ocr.ts
│   │   └── validators/         # Zod 스키마
│   └── types/                  # TypeScript 타입
├── workers/                    # Cloudflare Workers (별도 배포)
│   └── api/
├── data/                       # 검증 데이터셋 (개발용)
│   ├── speech.xml
│   ├── items_classified.json
│   └── tagging_results.json
└── docs/                       # 본 dev_kit 자료
    ├── PROJECT.md
    ├── SPEC.md
    ├── STRUCTURE_RULES.md
    ├── EVENT_TYPES.md
    ├── PROMPT_DESIGN.md
    ├── DATA_SOURCES.md
    ├── TECH_STACK.md
    └── ROADMAP.md
```

## 개발·배포 명령

```bash
# 초기 설정
npm install
npx wrangler d1 create mois-speech-db
npx wrangler kv:namespace create mois-speech-kv

# 개발
npm run dev         # Next.js
npx wrangler dev    # Workers (별도 터미널)

# 배포
npm run build
npx wrangler deploy
```

## 주의사항

- **HWPX 파싱·생성은 MVP에서 보류** (MD 출력만)
- **OCR은 행사계획서·참고자료의 이미지 처리 시점에 결정** (MVP 초기는 텍스트 파일만 우선 지원도 가능)
- **Claude API 비용**: 입력 컨텍스트가 크면(참고자료 다수 업로드 시) 비용 증가 → 캐싱 전략 필수
