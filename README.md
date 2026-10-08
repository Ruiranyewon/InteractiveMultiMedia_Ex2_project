# 상식 퀴즈 게임

역사·과학·문화·지리 4개 카테고리 × 10문제(총 40문제)를 풀고 순위에 도전하는 웹 게임입니다.
Next.js(App Router) + TypeScript + Tailwind + SQLite(better-sqlite3). 외부 계정·유료 서비스 없이 로컬에서 바로 실행됩니다.
기획 문서는 상위 폴더의 `PRD_상식퀴즈게임.md`, 단계별 요구는 `PRD_STEP_0*.md`를 참고하세요.

## 빠른 시작

```bash
npm install
npm run seed          # 120문제 적재 (data/quiz.db 생성)
npm run seed:demo     # (선택) 순위표 확인용 가짜 플레이어 50명
npm run dev           # http://localhost:3000
```

관리자 화면을 쓰려면 `ADMIN_PASSWORD=원하는값 npm run dev` 로 실행하고 `/admin` 에 접속합니다.

## 테스트·품질 점검

| 명령 | 내용 |
|---|---|
| `npm test` | Vitest 단위·API 테스트 (점수, 출제, 답 제출, 순위, 부정행위, 이어하기, 신고·관리자, 분석) |
| `npm run verify` | 문제 데이터 검증 (보기 4개, 정답 범위, 중복 없음) |
| `npm run test:e2e` | Playwright E2E + axe 접근성 검사. 자체 DB(`data/e2e.db`)와 3200 포트로 서버를 빌드·실행합니다. 시스템 Chrome을 사용합니다(없으면 `npx playwright install chromium` 후 `playwright.config.ts`의 `channel: "chrome"` 제거). 시간 초과 시나리오 때문에 약 1분 걸립니다. |
| `npm run lighthouse` | 프로덕션 서버(기본 `http://localhost:3300`)에 모바일 Lighthouse 실행. 성능·접근성 90 미만이면 종료 코드 1 |
| `npm run flags` | 부정행위 의심(flagged) 세션 목록 |

Lighthouse를 돌리려면 다른 터미널에서 `npm run build && npx next start -p 3300` 후 실행합니다.

## 운영 가이드

### 환경변수 (`.env.example` 참고)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `ADMIN_PASSWORD` | (없음) | 설정해야 `/admin` 이 켜집니다. 길고 무작위인 값을 쓰세요. |
| `QUIZ_DB_PATH` | `./data/quiz.db` | SQLite 파일 위치 |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | 공유 링크·OG 이미지 기준 주소 |
| `COOKIE_SECURE` | `0` | HTTPS 뒤에서는 `1` |
| `SESSION_RATE_LIMIT_PER_MIN` | `10` | IP당 분당 세션 생성 한도 |
| `ANSWER_RATE_LIMIT_PER_SEC` | `2` | 세션당 초당 답 제출 한도 |
| `ADMIN_LOGIN_FAIL_LIMIT` | `5` | 15분당 관리자 로그인 실패 한도 |
| `ANALYTICS_CONSOLE` | `1` | `0`이면 이벤트를 콘솔에 출력하지 않음(DB에는 저장) |
| `BLOCKLIST_PATH` | `./data/blocklist.txt` | 닉네임 금칙어 파일 |

### 실행

```bash
npm run build && npm start               # 기본 3000 포트
docker build -t quiz-game .
docker run -p 3000:3000 -v quiz-data:/data --env-file .env.local quiz-game
```

Docker 이미지는 시작할 때 DB가 비어 있을 때만 `data/questions.json`을 적재합니다(`npm run seed:init`).
`npm run seed` 는 문제 테이블을 **전부 지우고 다시 넣으므로** 운영 DB에서는 쓰지 마세요(관리자 화면에서 수정한 내용이 사라집니다).

### DB 백업

SQLite는 WAL 모드입니다. 서버가 켜져 있는 동안에는 파일 복사 대신 다음을 쓰세요.

```bash
sqlite3 data/quiz.db ".backup 'backup-$(date +%F).db'"
```

### 문제 추가

- 관리자 화면(`/admin`) → 문제 추가·수정·게시/비공개. 게시한 문제만 출제됩니다.
- 대량 추가: `data/questions.json` 에 같은 형식으로 추가하고 `npm run verify` 로 검증한 뒤, **빈 DB**에서 시드하거나 관리자 API를 사용합니다.
- 신고가 3건 쌓인 문제는 자동으로 `under_review` 가 되어 출제에서 빠집니다. `/admin` 에서 검토 후 다시 게시하세요.

### SQLite → Postgres 전환 시 수정할 곳

DB 접근은 `lib/db/` 한 곳에 모여 있습니다.

- `lib/db/connection.ts` — 연결·트랜잭션(`transaction()` 은 동기 API 가정). 비동기 드라이버로 바꾸면 호출하는 `lib/game/*`, API 라우트가 `await` 를 쓰도록 함께 바뀌어야 합니다.
- `lib/db/schema.ts` — DDL과 컬럼 마이그레이션(SQLite 문법: `INTEGER PRIMARY KEY`, `PRAGMA` 등).
- `lib/db/*.ts` — 쿼리(`?` 파라미터, `INSERT OR IGNORE`, `strftime` 등 SQLite 전용 구문 확인).
- 속도 제한(`lib/ratelimit.ts`)은 메모리 기반이라 서버를 여러 대로 늘리면 Redis 등 공유 저장소가 필요합니다.

## 알려진 한계 / 향후 과제

- 소셜 로그인 없음: 익명 ID(쿠키 + localStorage 백업) 기반이라 기기를 바꾸면 기록이 이어지지 않습니다. 향후 과제입니다.
- 연습 모드, 오답 노트는 미구현.
- 속도 제한이 프로세스 메모리 기반이라 다중 인스턴스에서는 공유되지 않습니다.
- 개인정보처리방침·이용약관은 **초안**입니다. 실제 서비스 전에 검토가 필요합니다.
- Dockerfile은 이 환경에서 빌드해 보지 못했습니다(Docker 데몬 미실행). 사용 전 `docker build` 로 확인하세요.
