export type Lang = "ko" | "en";

const dict = {
  // Header
  subtitle: {
    ko: "매일 업데이트 되는 쉬운 일본어 뉴스를 한국어 번역과 함께 읽어보세요",
    en: "Read easy Japanese news updated daily with translations",
  },
  countdownPrefix: {
    ko: "다음 업데이트까지",
    en: "Next update in",
  },
  weekendNotice: {
    ko: "주말에는 NHK 뉴스가 업데이트되지 않습니다",
    en: "NHK news is not updated on weekends",
  },
  countdownHour: { ko: "시간", en: "h" },
  countdownMin: { ko: "분", en: "m" },
  countdownSec: { ko: "초", en: "s" },
  refreshing: {
    ko: "오늘의 뉴스 데이터를 준비하고 있습니다...",
    en: "Preparing today's news data...",
  },

  // Loading / Error
  loadingNews: { ko: "뉴스 불러오는 중...", en: "Loading news..." },
  loadError: { ko: "뉴스를 불러올 수 없습니다", en: "Unable to load news" },
  retry: { ko: "다시 시도", en: "Retry" },
  noNews: { ko: "뉴스가 없습니다", en: "No news available" },
  loadingArticle: {
    ko: "기사 불러오는 중... (최초 로딩 시 시간이 걸릴 수 있습니다)",
    en: "Loading article... (may take a moment on first load)",
  },

  // Article detail
  backToList: { ko: "← 뉴스 목록", en: "← News List" },
  furigana: { ko: "후리가나", en: "Furigana" },
  translation: { ko: "한국어 번역", en: "Translation" },
  translating: { ko: "번역 중...", en: "Translating..." },

  // Color legend
  personName: { ko: "사람 이름", en: "Person" },
  placeName: { ko: "장소 이름", en: "Place" },
  companyGroup: { ko: "회사·단체", en: "Company/Group" },

  // Verb popover
  articleExpression: { ko: "기사 표현:", en: "In article:" },
  sameVerbDiffConj: { ko: "같은 동사, 다른 활용", en: "Same verb, different form" },
  diffVerbSameConj: { ko: "다른 동사, 같은 활용", en: "Different verb, same form" },

  // Footer
  footerProvided: {
    ko: "본 콘텐츠의 원문은",
    en: "Original content is provided by",
  },
  footerProvidedEnd: {
    ko: "에서 제공됩니다.",
    en: ".",
  },
  footerDisclaimer: {
    ko: "한국어 번역 및 문법 분석은 일본어 학습 목적으로만 제공되며, NHK의 공식 번역이 아닙니다.",
    en: "Translations and grammar analysis are for Japanese learning purposes only and are not official NHK translations.",
  },
  footerCopyright: {
    ko: "뉴스 저작권은 NHK에 있습니다",
    en: "News copyright belongs to NHK",
  },

  // Audio
  audioAvailable: { ko: "音声あり", en: "Audio" },
} as const;

export type I18nKey = keyof typeof dict;

export function t(key: I18nKey, lang: Lang): string {
  return dict[key][lang];
}
