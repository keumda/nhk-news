"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import Hls from "hls.js";

/* ─── StableHTML: renders HTML once via ref, survives parent re-renders ─── */
const StableHTML = memo(function StableHTML({ html, className }: { html: string; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
  }, [html]);
  return <div ref={ref} className={className} />;
}, (prev, next) => prev.html === next.html && prev.className === next.className);

/* ─── types ─── */
interface Article {
  news_id: string;
  title: string;
  title_with_ruby: string;
  outline_with_ruby: string;
  news_prearranged_time: string;
  news_web_image_uri?: string;
  news_easy_image_uri?: string;
  news_easy_voice_uri?: string;
  has_news_easy_voice?: boolean;
  has_news_web_image?: boolean;
  has_news_easy_image?: boolean;
}

interface ArticleDetail {
  id: string;
  body: string;
  audioUrl: string;
  paragraphCount: number;
}

interface VerbAnalysisItem {
  surfaceForm: string;
  dictionaryForm: string;
  reading: string;
  meaning: string;
  conjugationRule: string;
  conjugationDetail: string;
  exampleSameVerb: string;
  exampleSameVerbKo: string;
  exampleDiffVerb: string;
  exampleDiffVerbKo: string;
}

/* ─── constants ─── */
const SPEEDS = [0.5, 0.75, 1];

const proxyUrl = (url: string) =>
  url ? `/api/nhk/proxy?url=${encodeURIComponent(url)}` : "";

/* ─────────────────────────── main page ─────────────────────────── */
export default function NHKPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [detail, setDetail] = useState<ArticleDetail | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [translations, setTranslations] = useState<string[]>([]);
  const [titleTranslation, setTitleTranslation] = useState("");
  const [loadingTranslation, setLoadingTranslation] = useState(false);

  const [verbAnalysis, setVerbAnalysis] = useState<VerbAnalysisItem[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [showFurigana, setShowFurigana] = useState(true);
  const [showKorean, setShowKorean] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  /* ─── fetch article list + auto-refresh ─── */
  useEffect(() => {
    // Load articles (from cache or live)
    fetch("/api/nhk/news")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setArticles(data.articles || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    // Check cache freshness and trigger background refresh if stale
    fetch("/api/nhk/cache-status")
      .then((r) => r.json())
      .then((status) => {
        if (status.status === "stale" || status.status === "empty") {
          setRefreshing(true);
          fetch("/api/nhk/refresh", { method: "POST" })
            .then((r) => r.json())
            .then(() => fetch("/api/nhk/news"))
            .then((r) => r?.json())
            .then((data) => {
              if (data?.articles?.length) setArticles(data.articles);
            })
            .finally(() => setRefreshing(false));
        }
      })
      .catch(() => {});
  }, []);

  /* ─── extract plain text from html ─── */
  const htmlToText = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent?.trim() || "";
  };

  /* ─── translate paragraphs ─── */
  const translateBody = useCallback(
    (html: string, articleId?: string, cached?: { titleTranslation?: string; translations?: string[] }, title?: string) => {
      // Use cached translations if available from file cache
      if (cached?.translations && cached.translations.length > 0) {
        setTitleTranslation(cached.titleTranslation || "");
        setTranslations(cached.translations);
        return;
      }

      const div = document.createElement("div");
      div.innerHTML = html;
      const paras = Array.from(div.querySelectorAll("p")).filter(
        (p) => !!p.querySelector('span[class*="color"]')
      );
      const bodyTexts = paras
        .map((p) => p.textContent?.trim() || "")
        .filter((t) => t.length > 0);

      const plainTitle = title ? htmlToText(title) : "";

      if (bodyTexts.length === 0) return;

      setLoadingTranslation(true);
      fetch("/api/nhk/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: bodyTexts, articleId, title: plainTitle }),
      })
        .then((r) => r.json())
        .then((d) => {
          setTitleTranslation(d.titleTranslation || "");
          setTranslations(d.translations || []);
        })
        .catch(() => {})
        .finally(() => setLoadingTranslation(false));
    },
    []
  );

  /* ─── open article ─── */
  const openArticle = useCallback(
    async (article: Article) => {
      setSelectedId(article.news_id);
      setSelectedArticle(article);
      setDetail(null);
      setTranslations([]);
      setTitleTranslation("");
      setVerbAnalysis([]);
      setAudioUrl(null);
      setLoadingDetail(true);
      setIsPlaying(false);
      setAudioProgress(0);
      setAudioCurrentTime(0);
      setAudioDuration(0);
      window.scrollTo({ top: 0 });

      try {
        const res = await fetch(`/api/nhk/article?id=${article.news_id}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setDetail(data);
        translateBody(data.body, article.news_id, data.cachedTranslations ? { titleTranslation: data.cachedTitleTranslation, translations: data.cachedTranslations } : undefined, article.title_with_ruby || article.title);

        // Load verb analysis (cached or on-demand)
        if (data.cachedVerbAnalysis?.length) {
          setVerbAnalysis(data.cachedVerbAnalysis);
        } else {
          fetch("/api/nhk/verb-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ articleId: article.news_id, bodyHtml: data.body }),
          })
            .then((r) => r.json())
            .then((d) => { if (d.verbs?.length) setVerbAnalysis(d.verbs); })
            .catch(() => {});
        }

        // Fetch audio URL in background using voiceId
        if (article.has_news_easy_voice && article.news_easy_voice_uri) {
          fetch(`/api/nhk/audio?voiceId=${encodeURIComponent(article.news_easy_voice_uri)}`)
            .then((r) => r.json())
            .then((a) => {
              if (a.audioUrl) {
                setAudioUrl(a.audioUrl);
              }
            })
            .catch(() => {});
        }
      } catch {
        // If article body fetch fails, use the outline_with_ruby from the list
        setDetail({
          id: article.news_id,
          body: article.outline_with_ruby || "",
          audioUrl: "",
          paragraphCount: 1,
        });
        if (article.outline_with_ruby) {
          translateBody(article.outline_with_ruby, article.news_id, undefined);
        }
      } finally {
        setLoadingDetail(false);
      }
    },
    [translateBody]
  );

  /* ─── HLS audio setup ─── */
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const url = audioUrl;

    if (url.startsWith("/api/")) {
      // Local MP3 file — direct playback, no proxy needed
      audio.src = url;
    } else if (url.includes(".m3u8")) {
      // HLS stream via proxy (fallback)
      const proxied = proxyUrl(url);
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(proxied);
        hls.attachMedia(audio);
      } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = proxied;
      }
    } else if (url) {
      // Direct audio file
      audio.src = proxyUrl(url);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [audioUrl]);

  /* ─── audio helpers ─── */
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {/* AbortError: play interrupted by pause — safe to ignore */});
      setIsPlaying(true);
    }
  };

  const seekAudio = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audioDuration;
  };

  const skipAudio = (sec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + sec, audioDuration));
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  /* ─── verb hover — pure DOM popover (no React re-render) ─── */
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (verbAnalysis.length === 0 || !detail?.body || loadingDetail) return;

    // Delay to ensure DOM is fully committed after React render
    const rafId = setTimeout(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    const allSpans = document.querySelectorAll<HTMLElement>(".nhk-body span.color3, .nhk-body span.color4");
    if (allSpans.length === 0) return;

    // Build lookup: exact match + prefix match (for split spans like なっ→なって)
    const verbExact = new Map<string, VerbAnalysisItem>();
    const verbList = verbAnalysis;
    for (const v of verbList) verbExact.set(v.surfaceForm, v);

    const findVerb = (text: string): VerbAnalysisItem | undefined => {
      // 1. Exact match
      if (verbExact.has(text)) return verbExact.get(text);
      // 2. surfaceForm starts with span text (なっ matches なって)
      for (const v of verbList) {
        if (v.surfaceForm.startsWith(text) && text.length >= 1) return v;
      }
      // 3. span text starts with surfaceForm
      for (const v of verbList) {
        if (text.startsWith(v.surfaceForm)) return v;
      }
      return undefined;
    };

    const spanText = (el: HTMLElement): string => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("rt").forEach((rt) => rt.remove());
      return clone.textContent?.trim() || "";
    };

    const spans = allSpans;
    const handlers: Array<{ el: HTMLElement; enter: () => void; leave: () => void }> = [];

    const showPopover = (verb: VerbAnalysisItem, span: HTMLElement, rect: DOMRect) => {
      // Highlight the hovered span
      span.classList.add("verb-active");

      const conjDetail = (verb.conjugationDetail || "").replace(/\n/g, "<br>");
      const arrowId = "popover-arrow";
      popover.innerHTML = `
        <div id="${arrowId}" style="position:absolute;width:12px;height:12px;background:#fff;border:1px solid #e0e0e0;transform:rotate(45deg);z-index:-1"></div>
        <div style="position:relative;z-index:1;max-height:380px;overflow:auto">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px">
          <span style="font-size:22px;font-weight:700;color:#1a1a2e">${verb.dictionaryForm}</span>
          <span style="font-size:14px;color:#999">${verb.reading}</span>
        </div>
        <div style="font-size:14px;color:#555;margin-bottom:8px">${verb.meaning || ""}</div>
        <div style="font-size:13px;color:#888;margin-bottom:10px;padding:3px 8px;background:#f5f5f5;border-radius:4px;display:inline-block">기사 표현: ${verb.surfaceForm}</div>
        <div style="font-size:13px;color:#2c6fbb;background:#f0f6ff;padding:8px 12px;border-radius:8px;margin-bottom:6px;line-height:1.5;font-weight:600">${verb.conjugationRule}</div>
        <div style="font-size:13px;color:#444;background:#fafafa;padding:8px 12px;border-radius:8px;margin-bottom:14px;line-height:1.7;border-left:3px solid #ddd">${conjDetail}</div>
        <div style="margin-bottom:10px">
          <div style="font-size:11px;color:#999;font-weight:600;margin-bottom:4px">같은 동사, 다른 활용</div>
          <div style="font-size:15px;color:#222;line-height:1.8;margin-bottom:2px">${verb.exampleSameVerb}</div>
          <div style="font-size:13px;color:#2c6fbb;line-height:1.5">${verb.exampleSameVerbKo}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#999;font-weight:600;margin-bottom:4px">다른 동사, 같은 활용</div>
          <div style="font-size:15px;color:#222;line-height:1.8;margin-bottom:2px">${verb.exampleDiffVerb}</div>
          <div style="font-size:13px;color:#2c6fbb;line-height:1.5">${verb.exampleDiffVerbKo}</div>
        </div>
        </div>
      `;

      // Measure popover offscreen first
      popover.style.left = "-9999px";
      popover.style.top = "-9999px";
      popover.style.display = "block";

      const popW = 360;
      const popH = popover.offsetHeight;
      const gap = 10;
      const edgePad = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Horizontal: center on span, clamp to viewport edges
      let x = rect.left + rect.width / 2 - popW / 2;
      x = Math.max(edgePad, Math.min(x, vw - popW - edgePad));

      // Arrow horizontal position relative to popover
      const arrowX = Math.max(16, Math.min(rect.left + rect.width / 2 - x - 6, popW - 28));

      // Vertical: prefer below, fall back to above
      const spaceBelow = vh - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      let y: number;
      let arrowOnTop: boolean;

      if (spaceBelow >= popH || spaceBelow >= spaceAbove) {
        // Place below the word
        y = rect.bottom + gap;
        arrowOnTop = true;
      } else {
        // Place above the word
        y = rect.top - popH - gap;
        arrowOnTop = false;
      }

      // Clamp vertical to viewport
      y = Math.max(edgePad, Math.min(y, vh - popH - edgePad));

      popover.style.left = x + "px";
      popover.style.top = y + "px";

      // Position the arrow
      const arrow = popover.querySelector<HTMLElement>(`#${arrowId}`);
      if (arrow) {
        arrow.style.left = arrowX + "px";
        if (arrowOnTop) {
          arrow.style.top = "-7px";
          arrow.style.bottom = "";
          arrow.style.borderRight = "none";
          arrow.style.borderBottom = "none";
        } else {
          arrow.style.bottom = "-7px";
          arrow.style.top = "";
          arrow.style.borderLeft = "none";
          arrow.style.borderTop = "none";
        }
      }
    };

    let activeSpan: HTMLElement | null = null;
    const hidePopover = () => {
      popover.style.display = "none";
      if (activeSpan) { activeSpan.classList.remove("verb-active"); activeSpan = null; }
    };

    // Keep popover visible when hovering over it
    popover.addEventListener("mouseenter", () => { popover.style.display = "block"; });
    popover.addEventListener("mouseleave", hidePopover);

    spans.forEach((span) => {
      const text = spanText(span);
      const verb = findVerb(text);
      if (!verb) return;
      span.classList.add("verb-hover");

      const enter = () => {
        if (activeSpan && activeSpan !== span) activeSpan.classList.remove("verb-active");
        activeSpan = span;
        showPopover(verb, span, span.getBoundingClientRect());
      };
      const leave = () => { setTimeout(() => { if (!popover.matches(":hover")) hidePopover(); }, 100); };

      span.addEventListener("mouseenter", enter);
      span.addEventListener("mouseleave", leave);
      handlers.push({ el: span, enter, leave });
    });

    }, 100); // 100ms delay to ensure DOM is ready

    return () => {
      clearTimeout(rafId);
      // Clean up any verb-hover spans from previous run
      document.querySelectorAll(".verb-hover").forEach((el) => {
        el.classList.remove("verb-hover", "verb-active");
      });
      const popover = popoverRef.current;
      if (popover) popover.style.display = "none";
    };
  }, [detail?.body, verbAnalysis, loadingDetail]);

  /* ─── parse body paragraphs (memoized to avoid re-parsing) ─── */
  const parsedParagraphs = useMemo(() => {
    if (!detail?.body) return [];
    const div = document.createElement("div");
    div.innerHTML = detail.body;
    const paragraphs = Array.from(div.querySelectorAll("p")).filter(
      (p) => (p.textContent?.trim().length || 0) > 0
    );
    return paragraphs
      .filter((p) => !!p.querySelector('span[class*="color"]'))
      .map((p) => p.outerHTML);
  }, [detail?.body]);

  /* ═══════════════════ article detail view ═══════════════════ */
  if (selectedId && selectedArticle) {
    return (
      <div style={styles.root}>
        <div style={styles.container}>
          <button onClick={() => setSelectedId(null)} style={styles.backBtn}>
            ← 뉴스 목록
          </button>

          {loadingDetail ? (
            <div style={styles.center}>
              <div style={styles.spinner} />
              <p>기사 불러오는 중... (최초 로딩 시 시간이 걸릴 수 있습니다)</p>
            </div>
          ) : (
            <>
              {/* title with ruby */}
              <h1
                className={`nhk-body ${showFurigana ? "" : "hide-furigana"}`}
                style={styles.articleTitle}
                dangerouslySetInnerHTML={{
                  __html: selectedArticle.title_with_ruby || selectedArticle.title,
                }}
              />

              {showKorean && titleTranslation && (
                <p style={styles.titleKorean}>{titleTranslation}</p>
              )}

              <p style={styles.dateMeta}>
                {selectedArticle.news_prearranged_time}
              </p>

              {/* audio player */}
              {audioUrl && (
                <div style={styles.audioCard}>
                  <audio
                    ref={audioRef}
                    crossOrigin="anonymous"
                    onTimeUpdate={() => {
                      const a = audioRef.current;
                      if (!a) return;
                      setAudioCurrentTime(a.currentTime);
                      setAudioProgress(a.duration ? a.currentTime / a.duration : 0);
                    }}
                    onLoadedMetadata={() => {
                      const a = audioRef.current;
                      if (a) setAudioDuration(a.duration);
                    }}
                    onEnded={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  <div style={styles.audioControls}>
                    <button onClick={() => skipAudio(-10)} style={styles.skipBtn}>-10s</button>
                    <button onClick={togglePlay} style={styles.playBtn}>
                      {isPlaying ? "⏸" : "▶"}
                    </button>
                    <button onClick={() => skipAudio(10)} style={styles.skipBtn}>+10s</button>
                    <span style={styles.timeText}>
                      {fmt(audioCurrentTime)} / {fmt(audioDuration || 0)}
                    </span>
                  </div>
                  <div style={styles.progressBar} onClick={seekAudio}>
                    <div style={{ ...styles.progressFill, width: `${audioProgress * 100}%` }} />
                  </div>
                  <div style={styles.speedRow}>
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        style={{ ...styles.speedBtn, ...(speed === s ? styles.speedBtnActive : {}) }}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* toggles */}
              <div style={styles.toggleRow}>
                <label style={styles.toggle}>
                  <input type="checkbox" checked={showFurigana} onChange={() => setShowFurigana(!showFurigana)} />
                  <span>후리가나</span>
                </label>
                <label style={styles.toggle}>
                  <input type="checkbox" checked={showKorean} onChange={() => setShowKorean(!showKorean)} />
                  <span>한국어 번역</span>
                </label>
              </div>

              {/* color legend - NHK 3 categories */}
              <div style={styles.legend}>
                <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "rgb(29,177,6)" }} /> 人の名前（사람 이름）</span>
                <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "rgb(128,90,3)" }} /> 場所の名前（장소 이름）</span>
                <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "rgb(0,65,204)" }} /> 会社・グループ（회사·단체）</span>
              </div>

              {/* article body — each paragraph is keyed by HTML to avoid DOM replacement */}
              <div ref={bodyRef} style={styles.articleBody}>
                {parsedParagraphs.map((html, i) => {
                  const hasContent = html.length > 0;
                  let tIdx = 0;
                  for (let j = 0; j < i; j++) if (parsedParagraphs[j].length > 0) tIdx++;
                  const korean = hasContent ? translations[tIdx] : "";
                  return (
                    <div key={i} style={{ marginBottom: 20 }}>
                      <StableHTML
                        html={html}
                        className={`nhk-body ${showFurigana ? "" : "hide-furigana"}`}
                      />
                      {showKorean && hasContent && (
                        <div style={styles.korean}>
                          {loadingTranslation && !korean ? "번역 중..." : korean || ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* verb hover popover — DOM-controlled, not React state */}
              <div
                ref={popoverRef}
                style={{ ...styles.popover, display: "none" }}
              />
            </>
          )}
        </div>
        <style suppressHydrationWarning>{globalCSS}</style>
      </div>
    );
  }

  /* ═══════════════════ article list view ═══════════════════ */
  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>NHK やさしいにほんご</h1>
          <p style={styles.subtitle}>
            매일 업데이트 되는 쉬운 일본어 뉴스를 한국어 번역과 함께 읽어보세요
          </p>
          {refreshing && (
            <p style={styles.refreshing}>오늘의 뉴스 데이터를 준비하고 있습니다...</p>
          )}
        </header>

        {loading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
            <p>뉴스 불러오는 중...</p>
          </div>
        ) : error ? (
          <div style={styles.errorBox}>
            <p>뉴스를 불러올 수 없습니다</p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>{error}</p>
            <button onClick={() => window.location.reload()} style={styles.retryBtn}>
              다시 시도
            </button>
          </div>
        ) : articles.length === 0 ? (
          <p style={styles.center}>뉴스가 없습니다</p>
        ) : (
          <div style={styles.cardList}>
            {articles.map((a) => {
              const imgSrc =
                a.news_easy_image_uri ||
                a.news_web_image_uri ||
                "";
              return (
                <button
                  key={a.news_id}
                  onClick={() => openArticle(a)}
                  style={styles.card}
                >
                  {imgSrc && (
                    <div style={styles.cardImgWrap}>
                      <img
                        src={proxyUrl(imgSrc)}
                        alt=""
                        style={styles.cardImg}
                        onError={(e) => {
                          const wrapper = (e.currentTarget as HTMLImageElement).parentElement;
                          if (wrapper) wrapper.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <div style={styles.cardContent}>
                    <span style={styles.cardDate}>
                      {a.news_prearranged_time?.split(" ")[0]}
                    </span>
                    <h2
                      className="nhk-body"
                      style={styles.cardTitle}
                      dangerouslySetInnerHTML={{
                        __html: a.title_with_ruby || a.title,
                      }}
                    />
                    {/* outline preview */}
                    {a.outline_with_ruby && (
                      <p style={styles.cardOutline}>
                        {htmlToText(a.outline_with_ruby).substring(0, 80)}...
                      </p>
                    )}
                    {a.has_news_easy_voice && (
                      <span style={styles.audioTag}>音声あり</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <style suppressHydrationWarning>{globalCSS}</style>
    </div>
  );
}

/* ═══════════════════ CSS ═══════════════════ */
const globalCSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .nhk-body ruby { ruby-align: center; }
  .nhk-body rt {
    font-size: 0.55em;
    color: #888;
    font-weight: 400;
    user-select: none;
  }
  .nhk-body.hide-furigana rt {
    visibility: hidden; height: 0; overflow: hidden; display: block; font-size: 0;
  }
  .nhk-body a { color: inherit; text-decoration: none; cursor: default; }

  /* NHK color labels - exact match with NHK Easy News */
  .nhk-body .colorN { color: rgb(29, 177, 6); font-weight: 600; white-space: nowrap; }
  .nhk-body .colorL { color: rgb(128, 90, 3); font-weight: 600; white-space: nowrap; }
  .nhk-body .colorC { color: rgb(0, 65, 204); font-weight: 600; white-space: nowrap; }
  .nhk-body .colorN rt, .nhk-body .colorL rt, .nhk-body .colorC rt { font-weight: 400; color: #333; }
  .nhk-body .colorB, .nhk-body .colorF { }
  .nhk-body .color0, .nhk-body .color1, .nhk-body .color2,
  .nhk-body .color3, .nhk-body .color4, .nhk-body .color5 { }

  .nhk-body p {
    font-size: 19px;
    line-height: 2.2;
    color: #222;
    letter-spacing: 0.02em;
  }
  .verb-hover { cursor: help; transition: background 0.15s; border-radius: 3px; padding: 1px 3px; background: rgba(0,0,0,0.08); border-bottom: 1px dashed rgba(0,0,0,0.25); }
  .verb-hover:hover { background: rgba(52, 152, 219, 0.2); border-bottom-color: rgba(52, 152, 219, 0.5); }
  .verb-active { background: rgba(52, 152, 219, 0.25) !important; border-bottom-color: #3498db !important; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

/* ═══════════════════ styles ═══════════════════ */
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#f0f2f5",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", "Noto Sans JP", sans-serif',
  },
  container: { maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" },
  header: { textAlign: "center", marginBottom: 32, padding: "32px 0 24px" },
  title: { fontSize: 28, fontWeight: 800, color: "#1a1a2e", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", lineHeight: 1.6 },

  cardList: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    display: "flex", background: "#fff", borderRadius: 12, overflow: "hidden",
    border: "1px solid #e8e8e8", cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", textAlign: "left", width: "100%", font: "inherit",
  },
  cardImgWrap: { width: 120, minHeight: 90, flexShrink: 0, background: "#eee", overflow: "hidden" },
  cardImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  cardContent: { flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 },
  cardDate: { fontSize: 12, color: "#999", fontWeight: 500 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: "#222", lineHeight: 1.8 },
  cardOutline: { fontSize: 13, color: "#666", lineHeight: 1.5, overflow: "hidden" },
  audioTag: {
    display: "inline-block", fontSize: 11, color: "#3498db", background: "#ebf5fb",
    padding: "2px 8px", borderRadius: 4, width: "fit-content", fontWeight: 600,
  },

  backBtn: {
    display: "inline-flex", alignItems: "center", gap: 4, fontSize: 14,
    color: "#3498db", background: "none", border: "none", cursor: "pointer",
    padding: "8px 0", fontWeight: 600, marginBottom: 16, font: "inherit",
  },
  articleTitle: { fontSize: 24, fontWeight: 700, lineHeight: 2, color: "#1a1a2e", marginBottom: 8 },
  titleKorean: { fontSize: 15, color: "#2c6fbb", lineHeight: 1.6, marginBottom: 8 },
  dateMeta: { fontSize: 13, color: "#999", marginBottom: 20 },

  audioCard: {
    background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16,
    border: "1px solid #e8e8e8", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  audioControls: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  playBtn: {
    width: 44, height: 44, borderRadius: "50%", border: "none", background: "#3498db",
    color: "#fff", fontSize: 18, cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  skipBtn: {
    padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd",
    background: "#fafafa", fontSize: 12, cursor: "pointer", color: "#555", fontWeight: 600, font: "inherit",
  },
  timeText: { fontSize: 13, color: "#888", marginLeft: "auto", fontVariantNumeric: "tabular-nums" },
  progressBar: { height: 6, background: "#e8e8e8", borderRadius: 3, cursor: "pointer", marginBottom: 12, overflow: "hidden" },
  progressFill: { height: "100%", background: "#3498db", borderRadius: 3, transition: "width 0.1s linear" },
  speedRow: { display: "flex", gap: 6, justifyContent: "center" },
  speedBtn: {
    padding: "5px 12px", borderRadius: 6, border: "1px solid #ddd",
    background: "#fafafa", fontSize: 12, cursor: "pointer", fontWeight: 600, color: "#555", font: "inherit",
  },
  speedBtnActive: { background: "#3498db", color: "#fff", border: "1px solid #3498db" },

  legend: {
    display: "flex", flexWrap: "wrap" as const, gap: "8px 16px", marginBottom: 16,
    padding: "10px 14px", background: "#fff", borderRadius: 10,
    border: "1px solid #e8e8e8", fontSize: 12, color: "#666",
  },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#555" },
  legendDot: { width: 10, height: 10, borderRadius: "50%", background: "#805a03", flexShrink: 0 },

  toggleRow: { display: "flex", gap: 16, marginBottom: 20 },
  toggle: { display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#555", cursor: "pointer", userSelect: "none" },

  articleBody: {
    background: "#fff", borderRadius: 12, padding: "24px 20px",
    border: "1px solid #e8e8e8", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  korean: {
    fontSize: 15, color: "#2c6fbb", lineHeight: 1.7, marginTop: 6,
    padding: "8px 12px", background: "#f0f6ff", borderRadius: 8, borderLeft: "3px solid #3498db",
  },

  center: { textAlign: "center", padding: "60px 0", color: "#888" },
  spinner: {
    width: 32, height: 32, border: "3px solid #e8e8e8", borderTopColor: "#3498db",
    borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
  },
  refreshing: {
    fontSize: 13, color: "#3498db", marginTop: 8,
    padding: "6px 16px", background: "#ebf5fb", borderRadius: 8, display: "inline-block",
  },
  errorBox: { textAlign: "center", padding: 40, color: "#e74c3c" },
  retryBtn: {
    marginTop: 16, padding: "8px 24px", borderRadius: 8, border: "1px solid #e74c3c",
    background: "none", color: "#e74c3c", cursor: "pointer", fontWeight: 600, fontSize: 14, font: "inherit",
  },

  /* verb popover (positioned via JS) */
  popover: {
    position: "fixed" as const, width: 360, background: "#fff", borderRadius: 14,
    border: "1px solid #e0e0e0", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    padding: 18, zIndex: 1000, maxHeight: 420, overflow: "visible",
  },
};
