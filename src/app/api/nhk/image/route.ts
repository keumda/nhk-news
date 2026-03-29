import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { todayJST, yesterdayJST } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const cacheRoot = path.join(process.cwd(), "data/cache");
  const exts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

  // Search today, then yesterday, then all date dirs
  const dateDirs = [todayJST(), yesterdayJST()];
  try {
    const entries = fs.readdirSync(cacheRoot).filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e));
    for (const d of entries.sort().reverse()) {
      if (!dateDirs.includes(d)) dateDirs.push(d);
    }
  } catch { /* ignore */ }

  for (const dateStr of dateDirs) {
    for (const ext of exts) {
      const filePath = path.join(cacheRoot, dateStr, "images", `${id}${ext}`);
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 500) {
        const buf = fs.readFileSync(filePath);
        const mime = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : ext === ".webp" ? "image/webp" : "image/jpeg";
        return new NextResponse(buf, {
          headers: {
            "Content-Type": mime,
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }
  }

  return new NextResponse(null, { status: 404 });
}
