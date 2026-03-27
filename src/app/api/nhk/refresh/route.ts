import { NextResponse } from "next/server";
import { chromium } from "playwright";
import * as cheerio from "cheerio";
import {
  todayJST,
  readManifest,
  writeManifest,
  writeNewsList,
  readArticle,
  writeArticle,
  readTranslation,
  writeTranslation,
  readVerbAnalysis,
  writeVerbAnalysis,
  readAudio,
  writeAudio,
  cleanOldCaches,
  VerbAnalysisItem,
} from "@/lib/cache";

/* ─── lock ─── */
let refreshLock = false;

/* ─── types ─── */
interface Article {
  news_id: string;
  title: string;
  news_easy_voice_uri?: string;
  has_news_easy_voice?: boolean;
  [key: string]: unknown;
}

/* ─── helpers ─── */

function parseCookies(cookieStr: string, domain: string) {
  return cookieStr.split(";").map((c) => {
    const [name, ...rest] = c.trim().split("=");
    return {
      name: name.trim(),
      value: rest.join("=").trim(),
      domain,
      path: "/",
      sameSite: "None" as const,
      secure: true,
      httpOnly: false,
      expires: -1,
    };
  });
}

async function fetchNewsList(cookies: string): Promise<Article[]> {
  const res = await fetch("https://news.web.nhk/news/easy/top-list.json", {
    headers: {
      Cookie: cookies,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Referer: "https://news.web.nhk/news/easy/",
    },
  });
  if (!res.ok) throw new Error(`NHK responded ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).slice(0, 10);
}

async function scrapeArticle(
  id: string,
  cookies: string
): Promise<{ body: string; paragraphCount: number }> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies(parseCookies(cookies, "news.web.nhk"));
    const page = await context.newPage();

    await page.goto(`https://news.web.nhk/news/easy/${id}/${id}.html`, {
      waitUntil: "commit",
      timeout: 30000,
    });

    try {
      await page.waitForFunction(
        () => document.querySelectorAll("ruby rt").length > 5,
        { timeout: 20000 }
      );
    } catch {
      // continue
    }
    await page.waitForTimeout(2000);

    return await page.evaluate(() => {
      const paras = Array.from(document.querySelectorAll("p")).filter((p) =>
        p.querySelector('span[class*="color"]')
      );
      return {
        body: paras.map((p) => p.outerHTML).join("\n"),
        paragraphCount: paras.length,
      };
    });
  } finally {
    await browser.close();
  }
}

function extractTexts(html: string): string[] {
  const $ = cheerio.load(`<div>${html}</div>`);
  return $("p")
    .toArray()
    .filter((el) => $(el).find('span[class*="color"]').length > 0)
    .map((el) => $(el).text().trim())
    .filter((t) => t.length > 0);
}

async function translateTexts(texts: string[]): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || texts.length === 0) return texts.map(() => "");

  const numbered = texts.map((t, i) => `[${i + 1}] ${t}`).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `다음은 NHK やさしいにほんご(쉬운 일본어) 뉴스 기사의 문단들입니다. 각 문단을 자연스러운 한국어로 번역해주세요.

규칙:
- 번호 형식 [1], [2]... 을 유지하세요
- 일본어 읽기(후리가나)를 한국어에 포함하지 마세요
- 의역하여 자연스러운 한국어 문장으로 만드세요
- 번역만 출력하고 설명은 하지 마세요

${numbered}`,
        },
      ],
    }),
  });

  if (!res.ok) return texts.map(() => "[번역 실패]");

  const data = await res.json();
  const content = data.content?.[0]?.text || "";

  const translations: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const pattern = new RegExp(
      `\\[${i + 1}\\]\\s*(.+?)(?=\\[${i + 2}\\]|$)`,
      "s"
    );
    const match = content.match(pattern);
    translations.push(match?.[1]?.trim() || "[번역 실패]");
  }
  return translations;
}

async function analyzeVerbsForRefresh(bodyHtml: string): Promise<VerbAnalysisItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  // Extract verb candidates from color3/color4 spans
  const $ = cheerio.load(bodyHtml);
  const candidates = new Set<string>();
  $("span.color3, span.color4").each((_, el) => {
    const clone = $(el).clone();
    clone.find("rt").remove();
    const text = clone.text().trim();
    if (text.length > 0) candidates.add(text);
  });
  if (candidates.size === 0) return [];

  const candidateArr = Array.from(candidates);
  const numbered = candidateArr.map((c, i) => `[${i + 1}] ${c}`).join("\n");

  // Get plain text for context
  const $ctx = cheerio.load(bodyHtml);
  $ctx("rt").remove();
  const plainText = $ctx.text().trim();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: `당신은 일본어 문법 전문가입니다. NHK やさしいにほんご 뉴스 기사에서 추출한 동사/형용사를 한국어 학습자를 위해 분석해주세요.

기사 본문:
${plainText}

동사/형용사 후보:
${numbered}

중요: 후보 목록의 단어는 기사 문장에서 잘린 조각일 수 있습니다. 기사 본문의 문맥을 반드시 참고하여, 해당 단어가 실제 문장에서 어떤 전체 표현의 일부인지 파악하세요.

각 후보를 분석해주세요:
1. 동사 또는 い형용사가 아닌 경우 건너뛰세요
2. 동사/い형용사인 경우 아래 JSON 형식으로 분석해주세요

응답 형식 - JSON 배열만 출력:
[
  {
    "surfaceForm": "기사에 나온 활용형 그대로",
    "dictionaryForm": "사전형 (원형)",
    "reading": "사전형의 정확한 히라가나 읽기",
    "meaning": "사전형의 한국어 뜻",
    "conjugationRule": "활용 규칙 이름 (반드시 한국어로!)",
    "conjugationDetail": "변형 과정을 단계별로 한국어로 상세 설명",
    "exampleSameVerb": "같은 동사를 기사와는 다른 활용형/문법으로 사용한 예문 (일본어)",
    "exampleSameVerbKo": "위 예문의 한국어 번역",
    "exampleDiffVerb": "반드시 다른 동사를 기사와 같은 활용형으로 사용한 예문 (일본어)",
    "exampleDiffVerbKo": "위 예문의 한국어 번역"
  }
]

규칙:
- JSON 배열만 출력. 모든 설명은 반드시 한국어로.
- conjugationDetail이 가장 중요: 원형에서 기사 활용형까지 단계별 변형 설명.
- 복합동사는 각 동사의 역할과 결합 방식을 설명.
- reading은 정확한 히라가나.
- exampleDiffVerb는 반드시 다른 동사 사용!`,
      }],
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const content = data.content?.[0]?.text || "";

  try {
    const jsonStr = content.replace(/^```json?\s*/m, "").replace(/```\s*$/m, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v: Record<string, unknown>) =>
        v.surfaceForm && v.dictionaryForm && v.reading && v.meaning &&
        v.conjugationRule && v.conjugationDetail && v.exampleSameVerb && v.exampleDiffVerb,
    ) as VerbAnalysisItem[];
  } catch {
    return [];
  }
}

/**
 * Download audio as MP3 via ffmpeg.
 * 1. Get hdnts token from NHK
 * 2. ffmpeg downloads HLS stream → converts to MP3
 * 3. Saved to data/cache/{date}/audio-files/{newsId}.mp3
 * Returns local path or null on failure.
 */
async function downloadAudioMp3(
  newsId: string,
  voiceId: string,
  dateStr: string
): Promise<string | null> {
  const { execSync } = require("child_process");
  const fs = require("fs");
  const path = require("path");

  const cookieStr = process.env.NHK_COOKIES || "";
  // z_at is a JWT starting with "eyJ"
  const zAtMatch = cookieStr.match(/z_at=(eyJ[^;"]+)/);
  const zAt = zAtMatch?.[1] || "";

  const stem = voiceId.replace(/\.m4a$/, "");
  const baseUrl = `https://media.vd.st.nhk/news/easy_audio/${stem}/index.m3u8`;

  // Get fresh Akamai token
  let tokenizedUrl = baseUrl;
  if (zAt) {
    try {
      const tokenRes = await fetch("https://mediatoken.web.nhk/v1/token", {
        headers: {
          Authorization: `Bearer ${zAt}`,
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
          Referer: "https://news.web.nhk/",
        },
      });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        if (tokenData.token) tokenizedUrl = `${baseUrl}?hdnts=${tokenData.token}`;
      }
    } catch { /* use base URL */ }
  }

  // Ensure output directory exists
  const audioDir = path.join(process.cwd(), "data/cache", dateStr, "audio-files");
  fs.mkdirSync(audioDir, { recursive: true });
  const outPath = path.join(audioDir, `${newsId}.mp3`);

  // Skip if already downloaded
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
    return outPath;
  }

  try {
    // ffmpeg: download HLS → MP3 (128kbps, mono for speech)
    execSync(
      `ffmpeg -y -headers "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36\r\nReferer: https://news.web.nhk/\r\n" -i "${tokenizedUrl}" -vn -acodec libmp3lame -ab 128k -ac 1 "${outPath}" 2>/dev/null`,
      { timeout: 30000 }
    );
    const stat = fs.statSync(outPath);
    if (stat.size > 1000) {
      console.log(`[refresh] Audio downloaded: ${newsId} (${Math.round(stat.size / 1024)}KB)`);
      return outPath;
    }
  } catch (e) {
    console.error(`[refresh] ffmpeg failed for ${newsId}:`, e instanceof Error ? e.message : String(e));
  }
  return null;
}

/* ─── main refresh ─── */

export async function POST() {
  if (refreshLock) {
    return NextResponse.json({ status: "already_running" }, { status: 409 });
  }

  refreshLock = true;
  const dateStr = todayJST();
  const errors: string[] = [];

  try {
    // Clean old caches
    await cleanOldCaches();

    // Update manifest to "refreshing"
    await writeManifest({
      lastRefresh: new Date().toISOString(),
      currentDate: dateStr,
      status: "refreshing",
      articleCount: 0,
      errors: [],
    });

    const cookies = process.env.NHK_COOKIES || "";
    if (!cookies) throw new Error("NHK_COOKIES not set");

    // 1. Fetch news list
    console.log("[refresh] Fetching news list...");
    const articles = await fetchNewsList(cookies);
    await writeNewsList(articles, dateStr);

    // 2. Process each article
    let processed = 0;
    for (const article of articles) {
      const id = article.news_id;
      console.log(`[refresh] Processing ${id} (${processed + 1}/${articles.length})`);

      try {
        // Skip if already cached today
        const existingArticle = await readArticle(id, dateStr);
        const existingTranslation = await readTranslation(id, dateStr);

        // 2a. Scrape article
        let body: string;
        let paragraphCount: number;

        if (existingArticle) {
          body = existingArticle.body;
          paragraphCount = existingArticle.paragraphCount;
        } else {
          const scraped = await scrapeArticle(id, cookies);
          body = scraped.body;
          paragraphCount = scraped.paragraphCount;
          await writeArticle(id, {
            id,
            body,
            paragraphCount,
            fetchedAt: new Date().toISOString(),
          }, dateStr);
        }

        // 2b. Translate (title separately + body paragraphs)
        if (!existingTranslation && body) {
          const bodyTexts = extractTexts(body);
          // Extract plain title text (strip ruby/HTML)
          const titleHtml = (article.title_with_ruby as string) || article.title || "";
          const $title = cheerio.load(titleHtml);
          $title("rt").remove();
          const plainTitle = $title.text().trim();
          const allTexts = plainTitle ? [plainTitle, ...bodyTexts] : bodyTexts;
          if (allTexts.length > 0) {
            const allTranslations = await translateTexts(allTexts);
            let titleTranslation = "";
            let translations: string[];
            if (plainTitle) {
              titleTranslation = allTranslations[0] || "";
              translations = allTranslations.slice(1);
            } else {
              translations = allTranslations;
            }
            await writeTranslation(id, {
              id,
              titleTranslation,
              texts: bodyTexts,
              translations,
              fetchedAt: new Date().toISOString(),
            }, dateStr);
          }
        }

        // 2c. Verb analysis
        const existingVerbs = await readVerbAnalysis(id, dateStr);
        if (!existingVerbs && body) {
          try {
            const verbs = await analyzeVerbsForRefresh(body);
            if (verbs.length > 0) {
              await writeVerbAnalysis(id, {
                id,
                verbs,
                fetchedAt: new Date().toISOString(),
              }, dateStr);
            }
          } catch (verbErr) {
            console.error(`[refresh] Verb analysis failed for ${id}:`, verbErr);
          }
        }

        // 2d. Audio — download as MP3 locally
        if (article.has_news_easy_voice && article.news_easy_voice_uri) {
          const voiceId = article.news_easy_voice_uri as string;
          const mp3Path = await downloadAudioMp3(id, voiceId, dateStr);
          await writeAudio(id, {
            id,
            voiceId,
            audioUrl: mp3Path ? `/api/nhk/audio-file?id=${id}` : "",
            fetchedAt: new Date().toISOString(),
          }, dateStr);
        }
      } catch (e) {
        const msg = `Failed ${id}: ${e instanceof Error ? e.message : String(e)}`;
        console.error(`[refresh] ${msg}`);
        errors.push(msg);
      }

      processed++;
      // Small delay between articles
      if (processed < articles.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // 3. Write final manifest
    await writeManifest({
      lastRefresh: new Date().toISOString(),
      currentDate: dateStr,
      status: errors.length > 0 ? "partial" : "complete",
      articleCount: processed,
      errors,
    });

    console.log(`[refresh] Done. ${processed} articles, ${errors.length} errors.`);
    return NextResponse.json({
      status: errors.length > 0 ? "partial" : "complete",
      articlesProcessed: processed,
      errors,
    });
  } catch (error) {
    console.error("[refresh] Fatal error:", error);
    return NextResponse.json(
      { status: "error", error: String(error) },
      { status: 500 }
    );
  } finally {
    refreshLock = false;
  }
}
