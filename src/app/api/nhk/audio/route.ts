import { NextRequest, NextResponse } from "next/server";
import { readAudio, findCacheDate } from "@/lib/cache";

/**
 * Get audio URL for an article.
 * Returns local MP3 path if available from cache.
 */
export async function GET(request: NextRequest) {
  const voiceId = request.nextUrl.searchParams.get("voiceId");
  if (!voiceId) {
    return NextResponse.json({ error: "Missing voiceId" }, { status: 400 });
  }

  // Extract newsId from voiceId (e.g. "ne2026032711372_6UOY...m4a" → "ne2026032711372")
  const newsId = voiceId.match(/^(ne\d+)/)?.[1] || voiceId;

  const audioDate = await findCacheDate(newsId, "audio");
  const fileData = audioDate ? await readAudio(newsId, audioDate) : null;

  if (fileData?.audioUrl) {
    return NextResponse.json({ audioUrl: fileData.audioUrl });
  }

  // No cached audio
  return NextResponse.json({ audioUrl: "" });
}
