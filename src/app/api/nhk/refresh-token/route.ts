import { NextResponse } from "next/server";
import { chromium } from "playwright";

/**
 * Refresh NHK cookies using headless Playwright.
 * Opens NHK Easy News, clicks "I understood" overseas dialog,
 * captures fresh z_at + bff-rt-authz cookies, and updates process.env.
 *
 * POST /api/nhk/refresh-token
 */
export async function POST() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto("https://news.web.nhk/news/easy/", {
      waitUntil: "load",
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // Click "I understood" overseas dialog
    const confirmBtn = page.getByRole("button", {
      name: /確認しました|I understand/i,
    });
    if ((await confirmBtn.count()) > 0) {
      await confirmBtn.first().click();
      await page.waitForTimeout(5000);
    }

    // Extract cookies
    const cookies = await context.cookies();
    const zAt = cookies.find((c) => c.name === "z_at");
    if (!zAt) {
      return NextResponse.json(
        { error: "Failed to obtain z_at token" },
        { status: 500 },
      );
    }

    const cookieStr = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Update process.env for the current process (no file write on server)
    process.env.NHK_COOKIES = cookieStr;

    return NextResponse.json({
      success: true,
      cookieCount: cookies.length,
      hasZat: true,
      expiresAt: cookies.find((c) => c.name === "exp_z_at")?.value,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 500 },
    );
  } finally {
    if (browser) await browser.close();
  }
}
