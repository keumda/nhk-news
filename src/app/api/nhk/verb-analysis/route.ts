import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import {
  readVerbAnalysis,
  writeVerbAnalysis,
  findCacheDate,
  readPrompts,
  VerbAnalysisItem,
} from "@/lib/cache";
import { DEFAULT_VERB_ANALYSIS_PROMPT, EN_VERB_ANALYSIS_PROMPT } from "@/lib/prompts";

/**
 * Call Claude API to analyze all learnable words from the article.
 * Sends the full plain text — the AI identifies which words to analyze.
 */
async function analyzeWords(
  bodyHtml: string,
  lang?: string,
): Promise<VerbAnalysisItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Get plain text (strip all HTML + furigana)
  const $ = cheerio.load(bodyHtml);
  $("rt").remove();
  const plainText = $.text().trim();

  if (!plainText) return [];

  // Load custom prompt or use default (language-specific), then replace placeholders
  const saved = await readPrompts();
  const promptTemplate = lang === "en"
    ? EN_VERB_ANALYSIS_PROMPT
    : (saved?.verbAnalysisPrompt || DEFAULT_VERB_ANALYSIS_PROMPT);
  const prompt = promptTemplate
    .replace("{{plainText}}", plainText)
    .replace("{{numbered}}", ""); // backward compat: clear legacy placeholder

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16384,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Claude word analysis error:", res.status, err);
    return [];
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || "";

  // Parse JSON from response (handle possible markdown code fences)
  try {
    const jsonStr = content
      .replace(/^```json?\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim();
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    // Validate: surfaceForm must exist in the plain text
    return parsed.filter(
      (v: Record<string, unknown>) =>
        v.surfaceForm && v.dictionaryForm && v.reading && v.meaning &&
        typeof v.surfaceForm === "string" && plainText.includes(v.surfaceForm as string),
    ) as VerbAnalysisItem[];
  } catch (e) {
    console.error("Failed to parse word analysis JSON:", e);
    return [];
  }
}

/**
 * POST /api/nhk/verb-analysis
 * Analyze all learnable words in an article body. Caches results per article.
 */
export async function POST(request: NextRequest) {
  try {
    const { articleId, bodyHtml, lang } = (await request.json()) as {
      articleId: string;
      bodyHtml: string;
      lang?: string;
    };

    if (!articleId || !bodyHtml) {
      return NextResponse.json(
        { error: "Missing articleId or bodyHtml" },
        { status: 400 },
      );
    }

    // Check cache (scan all date directories)
    const verbDir = lang === "en" ? "verb-analysis-en" : "verb-analysis";
    const verbDate = await findCacheDate(articleId, verbDir);
    if (verbDate) {
      const cached = await readVerbAnalysis(articleId, verbDate, lang);
      if (cached && cached.verbs.length > 0) {
        return NextResponse.json({ verbs: cached.verbs });
      }
    }

    const verbs = await analyzeWords(bodyHtml, lang);

    // Cache results
    if (verbs.length > 0) {
      await writeVerbAnalysis(articleId, {
        id: articleId,
        verbs,
        fetchedAt: new Date().toISOString(),
      }, undefined, lang).catch(() => {});
    }

    return NextResponse.json({ verbs });
  } catch (error) {
    console.error("Word analysis error:", error);
    return NextResponse.json(
      { error: "Word analysis failed" },
      { status: 500 },
    );
  }
}
