import { NextRequest, NextResponse } from "next/server";
import { getNhkCookies } from "@/lib/nhk-auth";

const ALLOWED_HOSTS = [
  "news.web.nhk",
  "www3.nhk.or.jp",
  "media.vd.st.nhk",
  "nhks-vh.akamaihd.net",
];

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.some((h) => parsed.hostname.endsWith(h))) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    let cookies = "";
    try { cookies = await getNhkCookies(); } catch { /* no cookies available */ }
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        Referer: "https://news.web.nhk/",
        ...(parsed.hostname.endsWith("news.web.nhk") && cookies
          ? { Cookie: cookies }
          : {}),
      },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const body = await res.arrayBuffer();

    // For m3u8 playlists, rewrite segment URLs to go through proxy
    if (url.includes(".m3u8") || contentType.includes("mpegurl")) {
      const text = new TextDecoder().decode(body);
      // Use URL pathname (not full URL) to avoid query param `/` confusion
      const pathOnly = parsed.origin + parsed.pathname;
      const baseUrl = pathOnly.substring(0, pathOnly.lastIndexOf("/") + 1);
      const proxyLine = (rawUrl: string) => {
        const abs = rawUrl.startsWith("http") ? rawUrl : baseUrl + rawUrl;
        return `/api/nhk/proxy?url=${encodeURIComponent(abs)}`;
      };
      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          // Rewrite #EXT-X-KEY URI so encryption keys also go through proxy
          if (trimmed.startsWith("#EXT-X-KEY") && trimmed.includes("URI=")) {
            return trimmed.replace(/URI="([^"]+)"/, (_, uri) => `URI="${proxyLine(uri)}"`);
          }
          if (trimmed && !trimmed.startsWith("#")) {
            return proxyLine(trimmed);
          }
          return line;
        })
        .join("\n");

      return new NextResponse(rewritten, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    // For images and other media, pass through
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new NextResponse(null, { status: 502 });
  }
}
