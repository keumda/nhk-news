# NHK Easy News Reader

한국어 학습자를 위한 NHK やさしいにほんご 뉴스 리더. 일본어 기사를 읽으면서 한국어 번역, 동사 활용 분석, 오디오 재생을 한 곳에서 제공합니다.

## Features

- **NHK Easy News 기사 목록** — 최신 10개 기사를 후리가나와 함께 표시
- **한국어 번역** — Claude API를 활용한 문단별 자연스러운 한국어 번역
- **동사/형용사 활용 분석** — 기사에 등장하는 동사를 호버하면 사전형, 활용 규칙, 예문을 팝오버로 표시
- **오디오 재생** — NHK 음성을 MP3로 변환 후 캐싱, 속도 조절(0.5x/0.75x/1.0x) 지원
- **후리가나 토글** — 읽기 보조 표시를 켜고 끌 수 있음
- **파일 기반 캐싱** — 기사, 번역, 분석, 오디오를 날짜별로 캐싱하여 중복 요청 방지

## Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Scraping | Playwright (Chromium headless) |
| HTML Parsing | Cheerio |
| AI | Anthropic Claude API (Haiku) |
| Audio | HLS.js, ffmpeg (HLS → MP3 변환) |
| Deployment | Docker, Railway |

## Getting Started

### 환경 변수

`.env.local` 파일을 생성합니다:

```env
ANTHROPIC_API_KEY=sk-ant-...
NHK_COOKIES="z_at=...; bff-rt-authz=..."
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
  nhk-news
```

## API Routes

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/nhk/news` | GET | 기사 목록 조회 (캐시 우선) |
| `/api/nhk/article` | GET | 기사 본문 스크래핑 |
| `/api/nhk/translate` | POST | 한국어 번역 |
| `/api/nhk/verb-analysis` | POST | 동사/형용사 활용 분석 |
| `/api/nhk/audio` | GET | 캐싱된 오디오 URL 조회 |
| `/api/nhk/audio-file` | GET | MP3 파일 스트리밍 |
| `/api/nhk/refresh` | POST | 전체 기사 일괄 갱신 (스크래핑 + 번역 + 분석 + 오디오) |
| `/api/nhk/refresh-token` | POST | NHK 인증 쿠키 재발급 |
| `/api/nhk/proxy` | GET | NHK 리소스 프록시 (이미지, 오디오 스트림) |
| `/api/nhk/cache-status` | GET | 캐시 상태 확인 |

## Cache Structure

날짜별(JST 기준)으로 정리되며 7일 이후 자동 삭제됩니다:

```
data/cache/
  manifest.json
  2026-03-28/
    news-list.json
    articles/       {id}.json
    translations/   {id}.json
    verb-analysis/  {id}.json
    audio/          {id}.json
    audio-files/    {id}.mp3
```

## Architecture

```
User → Next.js App (page.tsx)
         ├─ /api/nhk/news        → NHK top-list.json
         ├─ /api/nhk/article     → Playwright → NHK article page
         ├─ /api/nhk/translate   → Claude API (Haiku)
         ├─ /api/nhk/verb-analysis → Claude API (Haiku)
         ├─ /api/nhk/audio       → ffmpeg (HLS → MP3)
         └─ /api/nhk/proxy       → NHK CDN (images, streams)
```
