import fs from "fs/promises";
import path from "path";

const CACHE_ROOT = path.join(process.cwd(), "data/cache");

/* ─── types ─── */
export interface Manifest {
  lastRefresh: string;
  currentDate: string;
  status: "complete" | "partial" | "refreshing";
  articleCount: number;
  errors: string[];
}

export interface CachedArticle {
  id: string;
  body: string;
  paragraphCount: number;
  fetchedAt: string;
}

export interface CachedTranslation {
  id: string;
  titleTranslation?: string;
  texts: string[];
  translations: string[];
  fetchedAt: string;
}

export interface CachedAudio {
  id: string;
  voiceId: string;
  audioUrl: string;
  fetchedAt: string;
}

export interface KanjiDetail {
  kanji: string;
  meaning: string;
  reading: string;
  similar: string;
  mnemonic: string;
}

export interface VerbAnalysisItem {
  surfaceForm: string;
  dictionaryForm: string;
  reading: string;
  meaning: string;
  conjugationRule: string;
  conjugationDetail: string;
  kanjiAnalysis?: KanjiDetail[];
  exampleSameVerb: string;
  exampleSameVerbKo: string;
  exampleDiffVerb: string;
  exampleDiffVerbKo: string;
}

export interface CachedVerbAnalysis {
  id: string;
  verbs: VerbAnalysisItem[];
  fetchedAt: string;
}

/* ─── helpers ─── */

/** Current date in JST (NHK operates in JST) as YYYY-MM-DD */
export function todayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

export function yesterdayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

function datePath(dateStr?: string): string {
  return path.join(CACHE_ROOT, dateStr || todayJST());
}

/**
 * Find which cache date directory contains a file for the given article.
 * Checks today first, then scans all date dirs in reverse order (newest first).
 * Returns the date string (e.g., "2026-03-27") or null if not found.
 */
export async function findCacheDate(
  newsId: string,
  subDir: string = "articles"
): Promise<string | null> {
  // Fast path: check today first
  const today = todayJST();
  const todayFile = path.join(CACHE_ROOT, today, subDir, `${newsId}.json`);
  try {
    await fs.access(todayFile);
    return today;
  } catch { /* not in today */ }

  // Scan all date directories (sorted newest first)
  try {
    const entries = await fs.readdir(CACHE_ROOT);
    const dateDirs = entries
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e) && e !== today)
      .sort()
      .reverse();
    for (const dir of dateDirs) {
      const filePath = path.join(CACHE_ROOT, dir, subDir, `${newsId}.json`);
      try {
        await fs.access(filePath);
        return dir;
      } catch { /* not in this dir */ }
    }
  } catch { /* cache root doesn't exist */ }

  return null;
}

async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = filePath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, filePath);
}

/* ─── manifest ─── */

export async function readManifest(): Promise<Manifest | null> {
  return readJSON<Manifest>(path.join(CACHE_ROOT, "manifest.json"));
}

export async function writeManifest(manifest: Manifest): Promise<void> {
  await writeJSON(path.join(CACHE_ROOT, "manifest.json"), manifest);
}

/* ─── news list ─── */

export async function readNewsList(dateStr?: string): Promise<unknown[] | null> {
  return readJSON<unknown[]>(path.join(datePath(dateStr), "news-list.json"));
}

export async function writeNewsList(articles: unknown[], dateStr?: string): Promise<void> {
  await writeJSON(path.join(datePath(dateStr), "news-list.json"), articles);
}

/* ─── article ─── */

export async function readArticle(newsId: string, dateStr?: string): Promise<CachedArticle | null> {
  return readJSON<CachedArticle>(path.join(datePath(dateStr), "articles", `${newsId}.json`));
}

export async function writeArticle(newsId: string, data: CachedArticle, dateStr?: string): Promise<void> {
  await writeJSON(path.join(datePath(dateStr), "articles", `${newsId}.json`), data);
}

/* ─── translation ─── */

function translationDir(lang?: string): string {
  return lang === "en" ? "translations-en" : "translations";
}

export async function readTranslation(newsId: string, dateStr?: string, lang?: string): Promise<CachedTranslation | null> {
  return readJSON<CachedTranslation>(path.join(datePath(dateStr), translationDir(lang), `${newsId}.json`));
}

export async function writeTranslation(newsId: string, data: CachedTranslation, dateStr?: string, lang?: string): Promise<void> {
  await writeJSON(path.join(datePath(dateStr), translationDir(lang), `${newsId}.json`), data);
}

/* ─── verb analysis ─── */

function verbAnalysisDir(lang?: string): string {
  return lang === "en" ? "verb-analysis-en" : "verb-analysis";
}

export async function readVerbAnalysis(newsId: string, dateStr?: string, lang?: string): Promise<CachedVerbAnalysis | null> {
  return readJSON<CachedVerbAnalysis>(path.join(datePath(dateStr), verbAnalysisDir(lang), `${newsId}.json`));
}

export async function writeVerbAnalysis(newsId: string, data: CachedVerbAnalysis, dateStr?: string, lang?: string): Promise<void> {
  await writeJSON(path.join(datePath(dateStr), verbAnalysisDir(lang), `${newsId}.json`), data);
}

/* ─── audio ─── */

export async function readAudio(newsId: string, dateStr?: string): Promise<CachedAudio | null> {
  return readJSON<CachedAudio>(path.join(datePath(dateStr), "audio", `${newsId}.json`));
}

export async function writeAudio(newsId: string, data: CachedAudio, dateStr?: string): Promise<void> {
  await writeJSON(path.join(datePath(dateStr), "audio", `${newsId}.json`), data);
}

/* ─── prompts ─── */

export interface PromptSettings {
  translationPrompt: string;
  verbAnalysisPrompt: string;
  updatedAt: string;
}

const PROMPTS_PATH = path.join(CACHE_ROOT, "prompts.json");

export async function readPrompts(): Promise<PromptSettings | null> {
  return readJSON<PromptSettings>(PROMPTS_PATH);
}

export async function writePrompts(data: PromptSettings): Promise<void> {
  await writeJSON(PROMPTS_PATH, data);
}

/* ─── cleanup ─── */

export async function cleanOldCaches(keepDays = 7): Promise<void> {
  try {
    const entries = await fs.readdir(CACHE_ROOT);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);

    for (const entry of entries) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(entry) && new Date(entry) < cutoff) {
        await fs.rm(path.join(CACHE_ROOT, entry), { recursive: true });
      }
    }
  } catch {
    // cache dir might not exist yet
  }
}
