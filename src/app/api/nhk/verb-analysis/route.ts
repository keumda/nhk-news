import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import {
  readVerbAnalysis,
  writeVerbAnalysis,
  findCacheDate,
  readPrompts,
  VerbAnalysisItem,
} from "@/lib/cache";
import { DEFAULT_VERB_ANALYSIS_PROMPT } from "@/lib/prompts";

/**
 * Extract verb/adjective candidate surface forms from NHK article HTML.
 * Targets span.color3 and span.color4 which contain verbs and conjugations.
 * Strips <rt> (furigana) tags to get the base text.
 */
function extractVerbCandidates(bodyHtml: string): string[] {
  const $ = cheerio.load(bodyHtml);
  const candidates = new Set<string>();

  $("span.color3, span.color4").each((_, el) => {
    // Clone and remove rt tags to get kanji + okurigana
    const clone = $(el).clone();
    clone.find("rt").remove();
    const text = clone.text().trim();
    if (text.length > 0) {
      candidates.add(text);
    }
  });

  return Array.from(candidates);
}

/**
 * Call Claude API to analyze verbs from the article.
 */
async function analyzeVerbs(
  bodyHtml: string,
  candidates: string[],
): Promise<VerbAnalysisItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Get plain text for context (strip all HTML)
  const $ = cheerio.load(bodyHtml);
  $("rt").remove();
  const plainText = $.text().trim();

  const numbered = candidates.map((c, i) => `[${i + 1}] ${c}`).join("\n");

  // Load custom prompt or use default, then replace placeholders
  const saved = await readPrompts();
  const promptTemplate = saved?.verbAnalysisPrompt || DEFAULT_VERB_ANALYSIS_PROMPT;
  const prompt = promptTemplate
    .replace("{{plainText}}", plainText)
    .replace("{{numbered}}", numbered);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
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
    console.error("Claude verb analysis error:", res.status, err);
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

    // Validate each entry
    return parsed.filter(
      (v: Record<string, unknown>) =>
        v.surfaceForm &&
        v.dictionaryForm &&
        v.reading &&
        v.meaning &&
        v.conjugationRule &&
        v.conjugationDetail &&
        v.exampleSameVerb &&
        v.exampleDiffVerb,
    ) as VerbAnalysisItem[];
  } catch (e) {
    console.error("Failed to parse verb analysis JSON:", e);
    return [];
  }
}

/**
 * POST /api/nhk/verb-analysis
 * Analyze verbs in an article body. Caches results per article.
 */
export async function POST(request: NextRequest) {
  try {
    const { articleId, bodyHtml } = (await request.json()) as {
      articleId: string;
      bodyHtml: string;
    };

    if (!articleId || !bodyHtml) {
      return NextResponse.json(
        { error: "Missing articleId or bodyHtml" },
        { status: 400 },
      );
    }

    // Check cache (scan all date directories)
    const verbDate = await findCacheDate(articleId, "verb-analysis");
    if (verbDate) {
      const cached = await readVerbAnalysis(articleId, verbDate);
      if (cached && cached.verbs.length > 0) {
        return NextResponse.json({ verbs: cached.verbs });
      }
    }

    // Extract candidates and analyze
    const candidates = extractVerbCandidates(bodyHtml);
    if (candidates.length === 0) {
      return NextResponse.json({ verbs: [] });
    }

    const verbs = await analyzeVerbs(bodyHtml, candidates);

    // Cache results
    if (verbs.length > 0) {
      await writeVerbAnalysis(articleId, {
        id: articleId,
        verbs,
        fetchedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return NextResponse.json({ verbs });
  } catch (error) {
    console.error("Verb analysis error:", error);
    return NextResponse.json(
      { error: "Verb analysis failed" },
      { status: 500 },
    );
  }
}
