import { NextResponse } from "next/server";
import { readNewsList, writeNewsList, todayJST, yesterdayJST } from "@/lib/cache";

const NHK_BASE = "https://news.web.nhk/news/easy";

export async function GET() {
  // L1: file cache (try today, then yesterday for date rollover)
  const fileArticles =
    (await readNewsList(todayJST())) || (await readNewsList(yesterdayJST()));
  if (fileArticles) {
    return NextResponse.json({ articles: fileArticles });
  }

  // L3: live fetch
  const cookies = process.env.NHK_COOKIES || "";
  if (!cookies) {
    return NextResponse.json(
      { error: "NHK_COOKIES env not set" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${NHK_BASE}/top-list.json`, {
      headers: {
        Cookie: cookies,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        Referer: `${NHK_BASE}/`,
      },
    });

    if (!res.ok) throw new Error(`NHK responded ${res.status}`);

    const data = await res.json();
    const articles = (Array.isArray(data) ? data : []).slice(0, 10);

    await writeNewsList(articles).catch(() => {});
    return NextResponse.json({ articles });
  } catch (error) {
    console.error("NHK news error:", error);
    return NextResponse.json(
      { error: "Failed to fetch NHK news" },
      { status: 500 }
    );
  }
}
