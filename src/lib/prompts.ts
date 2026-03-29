export const DEFAULT_TRANSLATION_PROMPT = `다음은 NHK やさしいにほんご(쉬운 일본어) 뉴스 기사의 문단들입니다. 각 문단을 자연스러운 한국어로 번역해주세요.

규칙:
- 번호 형식 [1], [2]... 을 유지하세요
- 일본어 읽기(후리가나)를 한국어에 포함하지 마세요
- 의역하여 자연스러운 한국어 문장으로 만드세요
- 번역만 출력하고 설명은 하지 마세요`;

export const DEFAULT_VERB_ANALYSIS_PROMPT = `당신은 일본어 문법 전문가입니다. NHK やさしいにほんご 뉴스 기사에서 추출한 동사/형용사를 한국어 학습자를 위해 분석해주세요.

기사 본문:
{{plainText}}

동사/형용사 후보:
{{numbered}}

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
    "conjugationDetail": "변형 과정을 단계별로 한국어로 상세하게 설명. 예시:\\n- 단순: '入る → 入って (5단동사 る→って, て형 변환)'\\n- 복합: '出す(내다) + 始める(시작하다) → 出し始める(내기 시작하다) → 出し始めました (ます형 과거: 始める→始めます→始めました)'\\n- ている: '少ない→少なく (く변환, い형용사 연용형) + なる→なっている (5단 る→って + いる 진행)'",
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
- 예문은 NHK Easy News 수준의 쉬운 일본어로 작성.`;

export const EN_TRANSLATION_PROMPT = `Below are paragraphs from an NHK やさしいにほんご (Easy Japanese) news article. Translate each paragraph into natural English.

Rules:
- Keep the numbering format [1], [2]...
- Do not include Japanese furigana readings in the English
- Translate naturally, not word-for-word
- Output only the translations, no explanations`;

export const EN_VERB_ANALYSIS_PROMPT = `You are a Japanese grammar expert. Analyze the verbs/adjectives extracted from an NHK やさしいにほんご news article for English-speaking learners.

Article text:
{{plainText}}

Verb/adjective candidates:
{{numbered}}

Important: The candidate words may be fragments from the article sentences. Always refer to the article text for context to understand what full expression each candidate belongs to.

Analyze each candidate:
1. Skip if it is not a verb or い-adjective (skip nouns, adverbs, conjunctions, numbers, etc.)
2. For verbs/い-adjectives, provide analysis in this JSON format

Response format - output ONLY a JSON array:
[
  {
    "surfaceForm": "The conjugated form exactly as it appears in the article",
    "dictionaryForm": "Dictionary form (base form)",
    "reading": "Exact hiragana reading of the dictionary form",
    "meaning": "English meaning of the dictionary form",
    "conjugationRule": "Name of the conjugation rule (in English)",
    "conjugationDetail": "Step-by-step explanation of the conjugation process in English",
    "exampleSameVerb": "Example sentence using the same verb in a different conjugation (in Japanese)",
    "exampleSameVerbKo": "English translation of the above example",
    "exampleDiffVerb": "Example sentence using a DIFFERENT verb in the same conjugation (in Japanese)",
    "exampleDiffVerbKo": "English translation of the above example"
  }
]

Rules:
- Output ONLY the JSON array. No other text.
- All explanations (meaning, conjugationRule, conjugationDetail) MUST be in English.
- conjugationDetail is the most important: explain step-by-step how the dictionary form becomes the conjugated form in the article.
- For compound verbs, explain each verb's role and how they combine.
- reading must be accurate hiragana.
- exampleDiffVerb MUST use a different verb!
- Write examples in simple Japanese (NHK Easy News level).`;
