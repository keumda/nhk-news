import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CACHE_ROOT = path.join(process.cwd(), "data/cache");

/**
 * Serve locally cached MP3 audio files.
 * GET /api/nhk/audio-file?id=ne2026032711372
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^ne\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Scan date dirs (newest first) to find the MP3
  try {
    const entries = fs.readdirSync(CACHE_ROOT);
    const dateDirs = entries
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e))
      .sort()
      .reverse();

    for (const dir of dateDirs) {
      const mp3Path = path.join(CACHE_ROOT, dir, "audio-files", `${id}.mp3`);
      if (fs.existsSync(mp3Path)) {
        const stat = fs.statSync(mp3Path);
        const stream = fs.readFileSync(mp3Path);

        return new NextResponse(stream, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": stat.size.toString(),
            "Cache-Control": "public, max-age=86400",
            "Accept-Ranges": "bytes",
          },
        });
      }
    }
  } catch {
    // fall through
  }

  return NextResponse.json({ error: "Audio not found" }, { status: 404 });
}
