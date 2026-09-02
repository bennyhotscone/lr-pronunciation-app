import { getJapaneseBlock } from "@/lib/japanese/blocks";
import { getBlocksForMilestone } from "@/lib/japanese/milestone";
import type { JapaneseWord } from "@/lib/japanese/types";

/** Bump to invalidate cached milestone stories (v5 = easier gate, fewer questions). */
export const MILESTONE_STORY_CACHE_VERSION = 5;

/** Stored in DB `vocabOnly` — must match for cache hits. */
export const MILESTONE_STORY_VOCAB_ONLY = true;

export type MilestoneTtsToken = {
  romaji: string;
  audio: string;
};

export type MilestoneComprehensionQ = {
  id: string;
  prompt: string;
  answer: string;
};

export type MilestoneProductionQ = {
  id: string;
  promptEnglish: string;
  targetRomaji: string;
  targetEnglish: string;
  blockNumber: number;
  wordIndex: number;
};

export type GeneratedMilestoneStory = {
  title: string;
  paragraphs: string[];
  /** Kana/audio per word, parallel to paragraphs — for word-by-word TTS. */
  ttsLines: MilestoneTtsToken[][];
  comprehension: MilestoneComprehensionQ[];
  production: MilestoneProductionQ[];
  vocabUsed: string[];
  vocabOnly: boolean;
  provider: string | null;
};

export type MilestoneGrammarContext = {
  hasCompletedGrammar: boolean;
  masteredGrammarIds: string[];
};

type MilestoneWord = JapaneseWord & { blockNumber: number; wordIndex: number };

const JP_SCRIPT_RE = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;
const ROMAJI_DISPLAY_RE = /[^a-zA-ZāēīōūĀĒĪŌŪ\s\-'()./]/g;

export function containsJapaneseScript(text: string): boolean {
  return JP_SCRIPT_RE.test(text);
}

export function stripNonRomajiDisplay(text: string): string {
  return text.replace(ROMAJI_DISPLAY_RE, "").replace(/\s+/g, " ").trim();
}

export function parseMilestoneStoryCacheVersion(provider: string | null): number {
  if (!provider) return 0;
  const match = provider.match(/^v(\d+)(?::|$)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

export function formatMilestoneStoryProvider(version: number, source: string): string {
  return `v${version}:${source}`;
}

export function storyCacheIsStale(
  provider: string | null,
  paragraphs: string[],
  vocabOnly?: boolean,
): boolean {
  if (!vocabOnly || vocabOnly !== MILESTONE_STORY_VOCAB_ONLY) return true;
  if (parseMilestoneStoryCacheVersion(provider) < MILESTONE_STORY_CACHE_VERSION) return true;
  return paragraphs.some((p) => containsJapaneseScript(p));
}

function primaryEnglish(word: JapaneseWord): string {
  return word.en.split("/")[0].replace(/\([^)]*\)/g, "").trim();
}

function collectMilestoneWords(milestoneNumber: number): MilestoneWord[] {
  const words: MilestoneWord[] = [];
  for (const blockNumber of getBlocksForMilestone(milestoneNumber)) {
    const block = getJapaneseBlock(blockNumber);
    block.forEach((word, wordIndex) => {
      words.push({ ...word, blockNumber, wordIndex });
    });
  }
  return words;
}

function pickDrillWords(allWords: MilestoneWord[], count = 10): MilestoneWord[] {
  if (allWords.length <= count) return [...allWords];
  const step = Math.max(1, Math.floor(allWords.length / count));
  const picked: MilestoneWord[] = [];
  for (let i = 0; i < allWords.length && picked.length < count; i += step) {
    picked.push(allWords[i]);
  }
  while (picked.length < count && picked.length < allWords.length) {
    const w = allWords[picked.length];
    if (!picked.includes(w)) picked.push(w);
    else break;
  }
  return picked;
}

function pickProductionWords(allWords: MilestoneWord[], count = 6): MilestoneWord[] {
  const step = Math.max(1, Math.floor(allWords.length / count));
  const picked: MilestoneWord[] = [];
  for (let i = 0; i < allWords.length && picked.length < count; i += step) {
    picked.push(allWords[i]);
  }
  while (picked.length < count && picked.length < allWords.length) {
    const w = allWords[picked.length];
    if (!picked.includes(w)) picked.push(w);
    else break;
  }
  return picked;
}

function allowedRomajiSet(allWords: MilestoneWord[]): Set<string> {
  return new Set(allWords.map((w) => w.r.toLowerCase()));
}

function romajiTokensFromLine(line: string): string[] {
  return line
    .split("\n")
    .map((row) => row.split(" - ")[0]?.trim() ?? "")
    .flatMap((romajiPart) =>
      romajiPart
        .toLowerCase()
        .split(/[.\s,;:!?]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    );
}

export function assertRomajiWhitelist(paragraphs: string[], allowed: Set<string>): void {
  for (const line of paragraphs) {
    if (containsJapaneseScript(line)) {
      throw new Error("Milestone story contains Japanese script in display text");
    }
    for (const token of romajiTokensFromLine(line)) {
      if (!allowed.has(token)) {
        throw new Error(`Milestone story romaji "${token}" is not in block vocab whitelist`);
      }
    }
  }
}

function formatWordLine(word: MilestoneWord): string {
  return `${word.r} - ${primaryEnglish(word)}`;
}

function buildTtsLine(words: MilestoneWord[]): MilestoneTtsToken[] {
  return words.map((w) => ({ romaji: w.r, audio: w.audio || w.r }));
}

function buildVocabOnlyStory(milestoneNumber: number): GeneratedMilestoneStory {
  const [blockA, blockB] = getBlocksForMilestone(milestoneNumber);
  const allWords = collectMilestoneWords(milestoneNumber);
  const drillWords = pickDrillWords(allWords, 10);

  const chunkSize = Math.ceil(drillWords.length / 3);
  const chunks: MilestoneWord[][] = [];
  for (let i = 0; i < drillWords.length; i += chunkSize) {
    chunks.push(drillWords.slice(i, i + chunkSize));
  }

  const paragraphs = chunks
    .map((chunk) =>
      chunk
        .map((w) => stripNonRomajiDisplay(formatWordLine(w)))
        .filter((line) => line.length > 0)
        .join("\n"),
    )
    .filter((p) => p.length > 0);

  const ttsLines = chunks.map(buildTtsLine);

  const questionWords = drillWords.slice(0, Math.min(8, drillWords.length));
  const comprehension: MilestoneComprehensionQ[] = questionWords.map((w, i) => ({
    id: `c${i + 1}`,
    prompt: `What does "${w.r}" mean?`,
    answer: primaryEnglish(w),
  }));

  const production = pickProductionWords(allWords, 6).map((w, i) => ({
    id: `p${i + 1}`,
    promptEnglish: primaryEnglish(w),
    targetRomaji: w.r,
    targetEnglish: w.en,
    blockNumber: w.blockNumber,
    wordIndex: w.wordIndex,
  }));

  const allowed = allowedRomajiSet(allWords);
  assertRomajiWhitelist(paragraphs, allowed);

  return {
    title: `Vocab checkpoint - Blocks ${blockA}-${blockB}`,
    paragraphs,
    ttsLines,
    comprehension,
    production,
    vocabUsed: drillWords.map((w) => w.r),
    vocabOnly: MILESTONE_STORY_VOCAB_ONLY,
    provider: formatMilestoneStoryProvider(MILESTONE_STORY_CACHE_VERSION, "vocab-drill"),
  };
}

/** Deterministic vocab checkpoint from block JSON — no LLM. */
export async function generateJapaneseMilestoneStory(
  milestoneNumber: number,
  _grammarContext?: MilestoneGrammarContext,
): Promise<GeneratedMilestoneStory> {
  void _grammarContext;
  return buildVocabOnlyStory(milestoneNumber);
}
