export const DEFAULT_TRANSLATION_PROMPT = `다음은 NHK やさしいにほんご(쉬운 일본어) 뉴스 기사의 문단들입니다. 각 문단을 자연스러운 한국어로 번역해주세요.

규칙:
- 번호 형식 [1], [2]... 을 유지하세요
- 일본어 읽기(후리가나)를 한국어에 포함하지 마세요
- 의역하여 자연스러운 한국어 문장으로 만드세요
- 번역만 출력하고 설명은 하지 마세요`;

export const DEFAULT_VERB_ANALYSIS_PROMPT = `당신은 일본어 문법 전문가입니다. NHK やさしいにほんご 뉴스 기사의 모든 학습 가치가 있는 단어를 한국어 학습자를 위해 빠짐없이 분석해주세요.

기사 본문:
{{plainText}}

위 기사에서 다음에 해당하는 모든 단어/표현을 찾아 분석해주세요:
1. 모든 동사 — 기사에 나온 활용형 그대로 (ます, ました, ている, ません, た, て, ない, れば 등 모든 형태)
2. 모든 형용사 — い형용사, な형용사 모두 (활용형 포함)
3. 한자가 포함된 모든 명사, 부사, 표현 (自転車, 交通, 違反, お金, 事故 등)
4. 문법적으로 중요한 복합 표현 (なければいけない, かもしれません, ことができる, によると 등)
5. 카타카나 외래어 (スマートフォン, ルール 등)
6. 건너뛸 것: 숫자 단독, 순수 조사(は/が/を/に/で/と/も), 문장부호(。、)만 건너뛰세요

핵심 규칙:
- surfaceForm은 위 기사 본문의 정확한 부분 문자열(substring)이어야 합니다. 기사 본문에 없는 텍스트를 surfaceForm으로 쓰지 마세요.
- 중요: surfaceForm에 조사를 포함하지 마세요! 단어/표현 자체만 포함합니다.
  나쁜 예: "自転車で", "お金を", "人は", "信号を", "に違反した", "交通事故が"
  좋은 예: "自転車", "お金", "人", "信号", "違反した", "交通事故"
  조사(は/が/を/に/で/と/も/から/まで/の/へ/や)는 단어의 일부가 아닙니다.
- 단, 문법 표현의 일부인 경우는 포함: "なければいけない", "かもしれません", "によると" 등은 OK
- 긴 표현과 그 안의 핵심 단어를 모두 별도 항목으로 분석하세요. 예: 기사에 "払わなければいけない"가 있으면 → "払わなければいけない" (문법 표현), "払う" (동사) 모두 분석
- 빠뜨리는 것보다 많이 분석하는 것이 좋습니다. 가능한 한 모든 단어를 분석하세요.

응답 형식 - JSON 배열만 출력:
[
  {
    "surfaceForm": "기사 본문에서 정확히 추출한 부분 문자열",
    "dictionaryForm": "사전형 (원형)",
    "reading": "사전형의 정확한 히라가나 읽기 (예: 入る→はいる, 始める→はじめる)",
    "meaning": "사전형의 한국어 뜻 (예: '들어가다', '시작하다', '적다/부족하다')",
    "conjugationRule": "활용 규칙 이름 (한국어로! 예: 'て형 연결', 'ます형 정중 과거', '복합동사 + ている 진행형') / 명사는 '명사', 부사는 '부사' 등",
    "conjugationDetail": "변형 과정을 단계별로 한국어로 상세하게 설명. 명사/부사의 경우 용법과 문맥 설명.",
    "kanjiAnalysis": [
      {
        "kanji": "개별 한자 1글자",
        "meaning": "이 한자의 한국어 뜻 (훈독/의미)",
        "reading": "이 한자의 읽기 (음독/훈독, 이 단어에서의 읽기)",
        "similar": "이 한자를 사용하는 다른 단어 2~3개 (예: '入口(いりぐち, 입구), 入学(にゅうがく, 입학)')",
        "mnemonic": "한자를 외우기 쉽게 모양의 유래, 비슷한 한자와의 구별법, 또는 연상법 (예: '入는 사람이 문으로 들어가는 모양')"
      }
    ],
    "exampleSameVerb": "같은 단어를 기사와는 다른 활용형/문법으로 사용한 예문 (일본어)",
    "exampleSameVerbKo": "위 예문의 한국어 번역",
    "exampleDiffVerb": "반드시 다른 단어를 기사와 같은 활용형으로 사용한 예문 (일본어)",
    "exampleDiffVerbKo": "위 예문의 한국어 번역"
  }
]

규칙:
- JSON 배열만 출력. 다른 텍스트 금지.
- 모든 설명은 반드시 한국어로.
- conjugationDetail이 가장 중요합니다. 원형에서 기사의 활용형까지 어떻게 변형되는지 단계별로 설명하세요.
- 복합동사(出し始める, 足りなくなる 등)는 각 구성 동사의 역할과 결합 방식을 설명.
- reading은 정확한 히라가나.
- exampleDiffVerb는 반드시 다른 단어를 사용!
- 예문은 NHK Easy News 수준의 쉬운 일본어.
- kanjiAnalysis: 한자 포함 단어만. 순수 히라가나 단어(する, いる 등)는 kanjiAnalysis를 빈 배열 [].
- kanjiAnalysis의 mnemonic: 모양 유래, 부수 설명, 비슷한 한자와의 차이 등 포함.
- 명사/부사 분석 시: conjugationRule은 "명사"/"부사"/"な형용사" 등으로, exampleSameVerb/exampleDiffVerb는 해당 단어의 다른 용법 예문으로 대체.`;

export const EN_TRANSLATION_PROMPT = `Below are paragraphs from an NHK やさしいにほんご (Easy Japanese) news article. Translate each paragraph into natural English.

Rules:
- Keep the numbering format [1], [2]...
- Do not include Japanese furigana readings in the English
- Translate naturally, not word-for-word
- Output only the translations, no explanations`;

export const EN_VERB_ANALYSIS_PROMPT = `You are a Japanese grammar expert. Analyze ALL learnable words from an NHK やさしいにほんご news article for English-speaking learners.

Article text:
{{plainText}}

Find and analyze ALL of the following from the article above:
1. All verbs — in their conjugated forms as they appear (ます, ました, ている, ません, た, て, ない, etc.)
2. All adjectives — い-adjectives and な-adjectives (including conjugated forms)
3. All kanji-containing nouns, adverbs, and expressions (自転車, 交通, 違反, etc.)
4. Important grammar patterns (なければいけない, かもしれません, ことができる, によると, etc.)
5. Katakana loanwords (スマートフォン, ルール, etc.)
6. Skip ONLY: standalone numbers, pure particles (は/が/を/に/で/と/も), punctuation

Critical rules:
- surfaceForm MUST be an exact substring of the article text above. Do not fabricate text.
- IMPORTANT: Do NOT include particles in surfaceForm! Only the word/expression itself.
  Bad: "自転車で", "お金を", "人は", "信号を", "に違反した"
  Good: "自転車", "お金", "人", "信号", "違反した"
  Particles (は/が/を/に/で/と/も/から/まで/の/へ/や) are NOT part of the word.
  Exception: grammar patterns like "なければいけない", "かもしれません" are OK.
- Analyze both long expressions AND their core words as separate entries. E.g., if "払わなければいけない" appears, analyze BOTH the full pattern AND "払う" separately.
- More analysis is better than less. Cover as many words as possible.

Response format - output ONLY a JSON array:
[
  {
    "surfaceForm": "Exact substring from the article text above",
    "dictionaryForm": "Dictionary form (base form)",
    "reading": "Exact hiragana reading of the dictionary form",
    "meaning": "English meaning of the dictionary form",
    "conjugationRule": "Name of the conjugation rule (in English). For nouns: 'noun', adverbs: 'adverb', etc.",
    "conjugationDetail": "Step-by-step explanation of the conjugation process in English. For nouns/adverbs: explain usage and context.",
    "kanjiAnalysis": [
      {
        "kanji": "Single kanji character",
        "meaning": "Meaning of this kanji",
        "reading": "Reading of this kanji (as used in this word)",
        "similar": "2-3 other words using this kanji",
        "mnemonic": "Visual mnemonic, radical breakdown, or etymology to help remember"
      }
    ],
    "exampleSameVerb": "Example sentence using the same word in a different form (in Japanese)",
    "exampleSameVerbKo": "English translation of the above example",
    "exampleDiffVerb": "Example sentence using a DIFFERENT word in the same form (in Japanese)",
    "exampleDiffVerbKo": "English translation of the above example"
  }
]

Rules:
- Output ONLY the JSON array. No other text.
- All explanations MUST be in English.
- conjugationDetail is the most important field.
- For compound verbs, explain each verb's role and how they combine.
- reading must be accurate hiragana.
- exampleDiffVerb MUST use a different word!
- Write examples in simple Japanese (NHK Easy News level).
- kanjiAnalysis: only for kanji-containing words. Pure hiragana words get empty array [].
- For nouns/adverbs: use exampleSameVerb/exampleDiffVerb for usage examples instead.`;
