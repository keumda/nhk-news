import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import {
  readVerbAnalysis,
  writeVerbAnalysis,
  findCacheDate,
  VerbAnalysisItem,
} from "@/lib/cache";

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
          content: `당신은 일본어 문법 전문가입니다. NHK やさしいにほんご 뉴스 기사에서 추출한 동사/형용사를 한국어 학습자를 위해 분석해주세요.

기사 본문:
${plainText}

동사/형용사 후보:
${numbered}

중요: 후보 목록의 단어는 기사 문장에서 잘린 조각일 수 있습니다. 기사 본문의 문맥을 반드시 참고하여, 해당 단어가 실제 문장에서 어떤 전체 표현의 일부인지 파악하세요.
예를 들어 "出し" 라는 후보가 있고 기사에 "出し始めました"가 있다면, 전체 표현 "出し始める"의 맥락에서 분석하세요.

각 후보를 분석해주세요:
1. 동사 또는 い형용사가 아닌 경우 (명사, 부사, 접속사, 숫자 등) 건너뛰세요
2. 동사/い형용사인 경우 아래 JSON 형식으로 분석해주세요

응답 형식 - JSON 배열만 출력:
[
  {
    "surfaceForm": "기사에 나온 활용형 그대로 (후보 목록의 텍스트와 정확히 일치)",
    "dictionaryForm": "사전형 (원형)",
    "reading": "사전형의 정확한 히라가나 읽기 (예: 入る→はいる, 始める→はじめる)",
    "meaning": "사전형의 한국어 뜻 (예: '들어가다', '시작하다', '적다/부족하다')",
    "conjugationRule": "활용 규칙 이름 (반드시 한국어로! 예: 'て형 연결', 'ます형 정중 과거', '복합동사 + ている 진행형')",
    "conjugationDetail": "변형 과정을 단계별로 한국어로 상세하게 설명. 예시:\n- 단순: '入る → 入って (5단동사 る→って, て형 변환)'\n- 복합: '出す(내다) + 始める(시작하다) → 出し始める(내기 시작하다) → 出し始めました (ます형 과거: 始める→始めます→始めました)'\n- ている: '少ない→少なく (く변환, い형용사 연용형) + なる→なっている (5단 る→って + いる 진행)'",
    "exampleSameVerb": "같은 동사를 기사와는 다른 활용형/문법으로 사용한 예문 (일본어). 예: 기사에서 '入って'(て형)이면 → '入りました'(ます형 과거)나 '入れば'(조건형) 등 다른 활용을 보여줘",
    "exampleSameVerbKo": "위 예문의 한국어 번역",
    "exampleDiffVerb": "반드시 다른 동사를 기사와 같은 활용형으로 사용한 예문 (일본어). 예: 기사에서 '入って'(て형)이면 → '食べて'(て형)나 '行って'(て형) 등",
    "exampleDiffVerbKo": "위 예문의 한국어 번역"
  }
]

규칙:
- JSON 배열만 출력. 다른 텍스트 금지.
- 모든 설명(meaning, conjugationRule, conjugationDetail)은 반드시 한국어로 작성.
- conjugationDetail이 가장 중요합니다. 원형에서 기사의 활용형까지 어떻게 변형되는지 단계별로 설명하세요.
- 복합동사(出し始める, 足りなくなる 등)는 각 동사의 역할과 결합 방식을 설명하세요.
- reading은 정확한 히라가나 (예: 入る→はいる, 出す→だす, 考える→かんがえる)
- exampleDiffVerb는 반드시 다른 동사를 사용! (入った → 食べた、行った 등)
- 예문은 NHK Easy News 수준의 쉬운 일본어로 작성.`,
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
