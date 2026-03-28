import { NextResponse } from "next/server";

const AUTH_URL =
  "https://news.web.nhk/tix/build_authorize?idp=a-alaz&profileType=abroad" +
  "&redirect_uri=https%3A%2F%2Fnews.web.nhk%2Fnews%2Feasy%2F&entity=none" +
  "&area=130&pref=13&jisx0402=13101&postal=1000001";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Parse Set-Cookie headers from a fetch Response into a simple map.
 * Merges into an existing cookie map so we accumulate across redirects.
 */
function parseSetCookies(
  res: Response,
  jar: Map<string, string>,
): void {
  // getSetCookie() returns an array of raw Set-Cookie header values
  const headers = res.headers.getSetCookie?.() ?? [];
  for (const h of headers) {
    const match = h.match(/^([^=]+)=([^;]*)/);
    if (match) jar.set(match[1], match[2]);
  }
}

/**
 * Follow the OAuth redirect chain manually, collecting cookies at each hop.
 * Returns the accumulated cookie jar.
 */
async function followAuthRedirects(
  existingCookies: string,
): Promise<Map<string, string>> {
  const jar = new Map<string, string>();

  // Seed jar with existing cookies
  for (const pair of existingCookies.split("; ")) {
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.substring(0, eq), pair.substring(eq + 1));
  }

  let url: string | null = AUTH_URL;
  let maxHops = 10;

  while (url && maxHops-- > 0) {
    const cookieHeader = Array.from(jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    const currentUrl: string = url;
    const fetchRes = await fetch(currentUrl, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Cookie: cookieHeader,
        Referer: "https://news.web.nhk/news/easy/",
      },
      redirect: "manual",
    });

    parseSetCookies(fetchRes, jar);

    const location = fetchRes.headers.get("location");
    if (fetchRes.status >= 300 && fetchRes.status < 400 && location) {
      url = location.startsWith("http")
        ? location
        : new URL(location, currentUrl).toString();
    } else {
      url = null;
    }
  }

  return jar;
}

/**
 * POST /api/nhk/refresh-token
 *
 * Refreshes NHK cookies by following the OAuth redirect chain.
 * No browser needed — pure HTTP redirects with existing cookies.
 */
export async function POST() {
  try {
    const currentCookies = process.env.NHK_COOKIES || "";
    if (!currentCookies) {
      return NextResponse.json(
        { error: "No existing NHK_COOKIES to refresh" },
        { status: 400 },
      );
    }

    const jar = await followAuthRedirects(currentCookies);

    const zAt = jar.get("z_at");
    if (!zAt) {
      return NextResponse.json(
        { error: "Failed to obtain z_at token" },
        { status: 500 },
      );
    }

    const cookieStr = Array.from(jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    process.env.NHK_COOKIES = cookieStr;

    const expZat = jar.get("exp_z_at");
    console.log(
      `[refresh-token] Success. z_at expires at ${expZat ? new Date(Number(expZat) * 1000).toISOString() : "unknown"}`,
    );

    return NextResponse.json({
      success: true,
      cookieCount: jar.size,
      hasZat: true,
      expiresAt: expZat,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 500 },
    );
  }
}
