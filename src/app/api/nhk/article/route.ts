import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import {
  readArticle,
  writeArticle,
  readTranslation,
  readVerbAnalysis,
  findCacheDate,
} from "@/lib/cache";

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

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // L1: file cache -- scan all date directories to find where article lives
  const articleDate = await findCacheDate(id, "articles");
  if (articleDate) {
    const fileData = await readArticle(id, articleDate);
    if (fileData) {
      // Look for translations & verb analysis in the same date dir first,
      // then scan other dates as fallback
      const transDate = await findCacheDate(id, "translations");
      const verbDate = await findCacheDate(id, "verb-analysis");

      const fileTrans = transDate ? await readTranslation(id, transDate) : null;
      const fileVerbs = verbDate ? await readVerbAnalysis(id, verbDate) : null;

      const data = {
        id: fileData.id,
        body: fileData.body,
        audioUrl: "",
        paragraphCount: fileData.paragraphCount,
        ...(fileTrans
          ? {
              cachedTitleTranslation: fileTrans.titleTranslation || "",
              cachedTranslations: fileTrans.translations,
            }
          : {}),
        ...(fileVerbs?.verbs?.length
          ? { cachedVerbAnalysis: fileVerbs.verbs }
          : {}),
      };
      return NextResponse.json(data);
    }
  }

  // L2: Playwright scrape (no file cache found)
  const cookieStr = process.env.NHK_COOKIES || "";
  if (!cookieStr) {
    return NextResponse.json({ error: "NHK_COOKIES not set" }, { status: 500 });
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addCookies(parseCookies(cookieStr, "news.web.nhk"));

    const page = await context.newPage();

    await page.goto(
      `https://news.web.nhk/news/easy/${id}/${id}.html`,
      { waitUntil: "commit", timeout: 30000 }
    );

    try {
      await page.waitForFunction(
        () => document.querySelectorAll("ruby rt").length > 5,
        { timeout: 20000 }
      );
    } catch {
      // continue
    }
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const paras = Array.from(document.querySelectorAll("p")).filter((p) =>
        p.querySelector('span[class*="color"]')
      );
      return {
        body: paras.map((p) => p.outerHTML).join("\n"),
        paragraphCount: paras.length,
      };
    });

    const data = {
      id,
      body: result.body,
      audioUrl: "",
      paragraphCount: result.paragraphCount,
    };

    await writeArticle(id, {
      id,
      body: result.body,
      paragraphCount: result.paragraphCount,
      fetchedAt: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json(data);
  } catch (error) {
    console.error("Article scrape error:", error);
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
