import { NextResponse } from "next/server";
import { readManifest, todayJST } from "@/lib/cache";

export async function GET() {
  const manifest = await readManifest();
  const today = todayJST();

  if (!manifest) {
    return NextResponse.json({ status: "empty", currentDate: today });
  }

  // Stale if cached date is not today
  if (manifest.currentDate !== today) {
    return NextResponse.json({
      status: "stale",
      currentDate: today,
      lastRefresh: manifest.lastRefresh,
    });
  }

  return NextResponse.json({
    status: manifest.status,
    currentDate: manifest.currentDate,
    lastRefresh: manifest.lastRefresh,
    articleCount: manifest.articleCount,
  });
}
