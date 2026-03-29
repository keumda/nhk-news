# NHK Easy News Reader

한국어/영어 학습자를 위한 NHK やさしいにほんご 뉴스 리더. 일본어 기사를 읽으면서 번역, 동사 활용 분석, 오디오 재생을 한 곳에서 제공합니다.

## Features

- **NHK Easy News 기사 목록** — 최신 10개 기사를 후리가나와 함께 표시
- **한국어/영어 번역** — Claude API를 활용한 문단별 자연스러운 번역 (언어 전환 지원)
- **동사/형용사 활용 분석** — 기사에 등장하는 동사를 호버하면 사전형, 활용 규칙, 예문을 팝오버로 표시
- **오디오 재생** — NHK 음성을 MP3로 변환 후 캐싱, 속도 조절(0.5x/0.75x/1.0x) 지원
- **후리가나 토글** — 읽기 보조 표시를 켜고 끌 수 있음
- **다국어 UI (한국어/English)** — 우측 상단 언어 토글로 전체 UI 및 번역 언어 전환
- **URL 기반 언어 진입** — `/en`으로 영어, `/ko` 또는 `/`로 한국어 기본 접속
- **자동 갱신 (Cron)** — 평일(월~금) JST 19:35에 node-cron으로 자동 뉴스 갱신
- **주말 안내** — 주말에는 NHK 업데이트가 없음을 카운트다운 타이머에 반영
- **방문자 카운터** — Upstash Redis로 일별/누적 방문자 수 추적
- **파일 기반 캐싱** — 기사, 번역, 분석, 오디오를 날짜별로 캐싱하여 중복 요청 방지
- **Railway Volume** — 배포 간 캐시 데이터 영구 보존
- **피드백 위젯** — 사용자 피드백 수집 (다국어 지원)

## Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Scraping | Playwright (Chromium headless) |
| HTML Parsing | Cheerio |
| AI | Anthropic Claude API (Haiku) |
| Audio | HLS.js, ffmpeg (HLS → MP3 변환) |
| Storage | Upstash Redis (방문자 카운터) |
| Scheduling | node-cron (평일 자동 갱신) |
| Deployment | Docker, Railway (Volume 마운트) |

## Getting Started

### 환경 변수

`.env.local` 파일을 생성합니다:

```env
ANTHROPIC_API_KEY=sk-ant-...
NHK_COOKIES="z_at=...; bff-rt-authz=..."
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

> NHK 쿠키는 앱 실행 후 `/api/nhk/refresh-token` POST 요청으로 자동 발급받을 수 있습니다.

### 로컬 실행

```bash
npm install
npx playwright install chromium
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

### Docker

```bash
docker build -t nhk-news .
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=... \
  -e NHK_COOKIES=... \
  -e UPSTASH_REDIS_REST_URL=... \
  -e UPSTASH_REDIS_REST_TOKEN=... \
  nhk-news
```

## Routes

| Path | 설명 |
|------|------|
| `/` | 메인 페이지 (한국어 기본) |
| `/ko` | 한국어 버전 |
| `/en` | 영어 버전 |

## API Routes

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/nhk/news` | GET | 기사 목록 조회 (캐시 우선) |
| `/api/nhk/article` | GET | 기사 본문 스크래핑 (`?lang=en` 지원) |
| `/api/nhk/translate` | POST | 번역 (`lang` 파라미터로 한/영 전환) |
| `/api/nhk/verb-analysis` | POST | 동사/형용사 활용 분석 (`lang` 파라미터 지원) |
| `/api/nhk/audio` | GET | 캐싱된 오디오 URL 조회 |
| `/api/nhk/audio-file` | GET | MP3 파일 스트리밍 |
| `/api/nhk/refresh` | POST | 전체 기사 일괄 갱신 (스크래핑 + 번역 + 분석 + 오디오) |
| `/api/nhk/refresh-token` | POST | NHK 인증 쿠키 재발급 |
| `/api/nhk/proxy` | GET | NHK 리소스 프록시 (이미지, 오디오 스트림) |
| `/api/nhk/cache-status` | GET | 캐시 상태 확인 |
| `/api/visitors` | GET/POST | 방문자 카운트 조회/증가 (Upstash Redis) |
| `/api/feedback` | POST | 사용자 피드백 전송 |

## Auto Refresh (Cron)

`node-cron`을 사용하여 Next.js `instrumentation.ts`에서 서버 시작 시 스케줄을 등록합니다.

- **스케줄**: 평일(월~금) JST 19:35 (`35 19 * * 1-5`)
- **동작**: NHK가 19:30에 업데이트한 뒤 5분 후 자동으로 `/api/nhk/refresh` 호출
- **주말**: 토/일에는 NHK 업데이트가 없으므로 cron 미실행, 카운트다운은 다음 월요일을 가리킴

## Visitor Counter (Upstash Redis)

Upstash Redis를 사용하여 방문자 수를 추적합니다.

- **일별 카운트**: `visitors:YYYY-MM-DD` 키 (KST 기준)
- **누적 카운트**: `visitors:total` 키
- **표시**: 좌하단에 `today N · total N` 형태
- **동작**: 페이지 로드 시 POST로 atomic increment, 결과를 화면에 표시

## Cache Structure

날짜별(JST 기준)으로 정리되며 7일 이후 자동 삭제됩니다:

```
data/cache/
  manifest.json
  2026-03-28/
    news-list.json
    articles/          {id}.json
    translations/      {id}.json    (한국어)
    translations-en/   {id}.json    (영어)
    verb-analysis/     {id}.json    (한국어)
    verb-analysis-en/  {id}.json    (영어)
    audio/             {id}.json
    audio-files/       {id}.mp3
```

> Railway Volume이 `/app/data`에 마운트되어 배포 간 캐시가 유지됩니다.

## Architecture

```
User → /en or /ko or /
         ↓
       Next.js App (page.tsx) ← lang toggle (ko/en)
         ├─ /api/nhk/news          → NHK top-list.json
         ├─ /api/nhk/article       → Playwright → NHK article page
         ├─ /api/nhk/translate     → Claude API (Haiku) [ko/en]
         ├─ /api/nhk/verb-analysis → Claude API (Haiku) [ko/en]
         ├─ /api/nhk/audio         → ffmpeg (HLS → MP3)
         ├─ /api/nhk/proxy         → NHK CDN (images, streams)
         ├─ /api/visitors          → Upstash Redis
         └─ instrumentation.ts     → node-cron (weekday 19:35 JST)
                                       ↓
                                   /api/nhk/refresh (auto)
```

## Railway Deployment

### 환경 변수 (Railway Dashboard 또는 CLI)

```bash
railway variables set ANTHROPIC_API_KEY=...
railway variables set UPSTASH_REDIS_REST_URL=...
railway variables set UPSTASH_REDIS_REST_TOKEN=...
```

### Volume

```bash
railway volume add --mount-path /app/data
```

> Volume이 마운트되면 캐시(번역, 분석, 오디오)가 배포 간에 유지됩니다.
> Dockerfile의 entrypoint에서 volume 권한을 자동으로 설정합니다.

### 배포

```bash
railway up --detach
```
