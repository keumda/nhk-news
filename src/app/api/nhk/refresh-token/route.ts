import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Refresh NHK cookies using headed Playwright.
 * Opens NHK Easy News, clicks "I understood" overseas dialog,
 * captures fresh z_at + bff-rt-authz cookies, and writes them to .env.local.
 *
 * POST /api/nhk/refresh-token
 */
export async function POST() {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
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

    // Update .env.local
    const envPath = resolve(process.cwd(), ".env.local");
    let envContent = readFileSync(envPath, "utf-8");
    envContent = envContent.replace(
      /NHK_COOKIES="[^"]*"/,
      `NHK_COOKIES="${cookieStr}"`,
    );
    writeFileSync(envPath, envContent, "utf-8");

    // Also update process.env for the current process
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
