import { NextRequest, NextResponse } from "next/server";
import { readTranslation, writeTranslation, findCacheDate, readPrompts } from "@/lib/cache";
import { DEFAULT_TRANSLATION_PROMPT, EN_TRANSLATION_PROMPT } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const { texts, articleId, title, lang } = (await request.json()) as {
      texts: string[];
      articleId?: string;
      title?: string;
      lang?: string;
    };

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: "Missing texts array" },
        { status: 400 }
      );
    }

    const transDir = lang === "en" ? "translations-en" : "translations";

    // Check file cache if articleId provided (scan all date directories)
    if (articleId) {
      const transDate = await findCacheDate(articleId, transDir);
      if (transDate) {
        const cached = await readTranslation(articleId, transDate, lang);
        if (cached && cached.translations.length >= texts.length) {
          return NextResponse.json({
            titleTranslation: cached.titleTranslation || "",
            translations: cached.translations,
          });
        }
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not set" },
        { status: 500 }
      );
    }

    // Build translation request: title (if provided) + body texts
    const allTexts = title ? [title, ...texts] : texts;
    const numbered = allTexts
      .map((t, i) => `[${i + 1}] ${t.trim()}`)
      .join("\n");

    // Load custom prompt or use default (language-specific)
    const saved = await readPrompts();
    const promptTemplate = lang === "en"
      ? EN_TRANSLATION_PROMPT
      : (saved?.translationPrompt || DEFAULT_TRANSLATION_PROMPT);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `${promptTemplate}\n\n${numbered}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Claude API error:", res.status, err);
      return NextResponse.json(
        { error: "Translation API failed" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const content = data.content?.[0]?.text || "";

    // Parse numbered translations
    const allTranslations: string[] = [];
    for (let i = 0; i < allTexts.length; i++) {
      const pattern = new RegExp(
        `\\[${i + 1}\\]\\s*(.+?)(?=\\[${i + 2}\\]|$)`,
        "s"
      );
      const match = content.match(pattern);
      allTranslations.push(match?.[1]?.trim() || "[번역 실패]");
    }

    // Split title and body translations
    let titleTranslation = "";
    let translations: string[];
    if (title) {
      titleTranslation = allTranslations[0] || "";
      translations = allTranslations.slice(1);
    } else {
      translations = allTranslations;
    }

    // Save to file cache
    if (articleId) {
      await writeTranslation(articleId, {
        id: articleId,
        titleTranslation,
        texts,
        translations,
        fetchedAt: new Date().toISOString(),
      }, undefined, lang).catch(() => {});
    }

    return NextResponse.json({ titleTranslation, translations });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
