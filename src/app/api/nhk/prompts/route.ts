import { NextRequest, NextResponse } from "next/server";
import { readPrompts, writePrompts } from "@/lib/cache";
import {
  DEFAULT_TRANSLATION_PROMPT,
  DEFAULT_VERB_ANALYSIS_PROMPT,
} from "@/lib/prompts";

/** GET /api/nhk/prompts — return current prompt settings */
export async function GET() {
  const saved = await readPrompts();
  return NextResponse.json({
    translationPrompt: saved?.translationPrompt || DEFAULT_TRANSLATION_PROMPT,
    verbAnalysisPrompt:
      saved?.verbAnalysisPrompt || DEFAULT_VERB_ANALYSIS_PROMPT,
    updatedAt: saved?.updatedAt || null,
  });
}

/** PUT /api/nhk/prompts — update prompt settings */
export async function PUT(request: NextRequest) {
  try {
    const { translationPrompt, verbAnalysisPrompt } = await request.json();

    if (typeof translationPrompt !== "string" || typeof verbAnalysisPrompt !== "string") {
      return NextResponse.json({ error: "Invalid prompt data" }, { status: 400 });
    }

    await writePrompts({
      translationPrompt,
      verbAnalysisPrompt,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Prompt save error:", error);
    return NextResponse.json({ error: "Failed to save prompts" }, { status: 500 });
  }
}
