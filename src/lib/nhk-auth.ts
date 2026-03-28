/**
 * NHK token auto-refresh utility.
 * Checks z_at expiration and refreshes via OAuth redirect chain if needed.
 */

const AUTH_URL =
  "https://news.web.nhk/tix/build_authorize?idp=a-alaz&profileType=abroad" +
  "&redirect_uri=https%3A%2F%2Fnews.web.nhk%2Fnews%2Feasy%2F&entity=none" +
  "&area=130&pref=13&jisx0402=13101&postal=1000001";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function parseSetCookies(res: Response, jar: Map<string, string>): void {
  const headers = res.headers.getSetCookie?.() ?? [];
  for (const h of headers) {
    const match = h.match(/^([^=]+)=([^;]*)/);
    if (match) jar.set(match[1], match[2]);
  }
}

async function followAuthRedirects(
  existingCookies: string,
): Promise<Map<string, string>> {
  const jar = new Map<string, string>();
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
      headers: { "User-Agent": UA, Cookie: cookieHeader, Referer: "https://news.web.nhk/news/easy/" },
      redirect: "manual",
    });

    parseSetCookies(fetchRes, jar);

    const location = fetchRes.headers.get("location");
    if (fetchRes.status >= 300 && fetchRes.status < 400 && location) {
      url = location.startsWith("http") ? location : new URL(location, currentUrl).toString();
    } else {
      url = null;
    }
  }

  return jar;
}

/** Returns true if the z_at token expires within the given buffer (default 30min) */
function isTokenExpiringSoon(cookies: string, bufferSec = 1800): boolean {
  const match = cookies.match(/exp_z_at=(\d+)/);
  if (!match) return true; // no expiration info → refresh
  const expiresAt = Number(match[1]);
  return Date.now() / 1000 + bufferSec >= expiresAt;
}

let refreshing: Promise<string> | null = null;

/**
 * Get valid NHK cookies. Auto-refreshes if token is expired or expiring soon.
 * Returns the cookie string ready for use in HTTP headers.
 */
export async function getNhkCookies(): Promise<string> {
  const current = process.env.NHK_COOKIES || "";
  if (!current) throw new Error("NHK_COOKIES env not set");

  if (!isTokenExpiringSoon(current)) return current;

  // Deduplicate concurrent refresh attempts
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      console.log("[nhk-auth] Token expiring soon, refreshing...");
      const jar = await followAuthRedirects(current);
      const zAt = jar.get("z_at");
      if (!zAt) throw new Error("Refresh failed: no z_at in response");

      const cookieStr = Array.from(jar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");

      process.env.NHK_COOKIES = cookieStr;

      const expZat = jar.get("exp_z_at");
      console.log(
        `[nhk-auth] Refreshed. Expires ${expZat ? new Date(Number(expZat) * 1000).toISOString() : "unknown"}`,
      );

      return cookieStr;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}
