/**
 * Mandarin-speaker English vocabulary curriculum.
 * Designed for 50 groups × 100 words = 5,000 total.
 *
 * Word order follows the standard COCA-style frequency lemma list
 * (the, be, and, of, a, in, to, have, it, I, …) — NOT the ZIP POC list,
 * which wrongly inserted a second "to" at rank 9 and "'s" at rank 19 and
 * shifted every label after that.
 *
 * Audio: ranks 1–8 kept; ranks 9–18 remapped from old 10–19 files
 * (old 0009-to was a spurious duplicate cut). Old 0020 is “they” (not “this”).
 * Rank 19 “this” is missing from the ZIP batch and awaits a clean cut.
 */

export const TOTAL_WORDS = 5000;
export const GROUP_SIZE = 100;
export const TOTAL_GROUPS = TOTAL_WORDS / GROUP_SIZE; // 50
export const AUDIO_BASE = "/audio/mandarin-vocab";

export type DifficultyMode = "mandarin" | "english" | "easy";

export type MandarinVocabWord = {
  rank: number;
  word: string;
  /** Filename only, e.g. 0001-the.mp3. Empty when audio is not ready. */
  audioFile: string;
  zh: string;
  en: string;
  group: number;
};

/**
 * First 20 frequency ranks with corrected labels/definitions.
 * Only entries with audioFile are used in the live quiz.
 */
export const MANDARIN_VOCAB_WORDS: MandarinVocabWord[] = [
  {
    rank: 1,
    word: "the",
    audioFile: "0001-the.mp3",
    zh: "这个／那个（定冠词）",
    en: "used before a specific person or thing",
    group: 1,
  },
  {
    rank: 2,
    word: "be",
    audioFile: "0002-be.mp3",
    zh: "是；成为",
    en: "to exist or have a particular state",
    group: 1,
  },
  {
    rank: 3,
    word: "and",
    audioFile: "0003-and.mp3",
    zh: "和；而且",
    en: "used to connect words or ideas",
    group: 1,
  },
  {
    rank: 4,
    word: "of",
    audioFile: "0004-of.mp3",
    zh: "……的；属于",
    en: "used to show connection or belonging",
    group: 1,
  },
  {
    rank: 5,
    word: "a",
    audioFile: "0005-a.mp3",
    zh: "一个（不定冠词）",
    en: "used before one non-specific thing",
    group: 1,
  },
  {
    rank: 6,
    word: "in",
    audioFile: "0006-in.mp3",
    zh: "在……里面",
    en: "inside a place, area, or period of time",
    group: 1,
  },
  {
    rank: 7,
    word: "to",
    audioFile: "0007-to.mp3",
    zh: "去；向；到",
    en: "in the direction of a place or person",
    group: 1,
  },
  {
    rank: 8,
    word: "have",
    audioFile: "0008-have.mp3",
    zh: "有；拥有",
    en: "to own, hold, or possess something",
    group: 1,
  },
  {
    rank: 9,
    word: "it",
    audioFile: "0009-it.mp3",
    zh: "它；这件事",
    en: "a pronoun for a thing or situation",
    group: 1,
  },
  {
    rank: 10,
    word: "I",
    audioFile: "0010-i.mp3",
    zh: "我",
    en: "the speaker referring to himself or herself",
    group: 1,
  },
  {
    rank: 11,
    word: "that",
    audioFile: "0011-that.mp3",
    zh: "那个；引导从句",
    en: "used to point to something or introduce a clause",
    group: 1,
  },
  {
    rank: 12,
    word: "for",
    audioFile: "0012-for.mp3",
    zh: "为了；给；对于",
    en: "intended to help, benefit, or be used by",
    group: 1,
  },
  {
    rank: 13,
    word: "you",
    audioFile: "0013-you.mp3",
    zh: "你；你们",
    en: "the person or people being spoken to",
    group: 1,
  },
  {
    rank: 14,
    word: "he",
    audioFile: "0014-he.mp3",
    zh: "他",
    en: "a male person already mentioned",
    group: 1,
  },
  {
    rank: 15,
    word: "with",
    audioFile: "0015-with.mp3",
    zh: "和；带着；用",
    en: "together with or using something",
    group: 1,
  },
  {
    rank: 16,
    word: "on",
    audioFile: "0016-on.mp3",
    zh: "在……上面",
    en: "touching or supported by a surface",
    group: 1,
  },
  {
    rank: 17,
    word: "do",
    audioFile: "0017-do.mp3",
    zh: "做；进行",
    en: "to perform an action or activity",
    group: 1,
  },
  {
    rank: 18,
    word: "say",
    audioFile: "0018-say.mp3",
    zh: "说；讲",
    en: "to speak words or express something",
    group: 1,
  },
  {
    rank: 19,
    word: "this",
    audioFile: "0019-this.mp3",
    zh: "这个；这",
    en: "used to point to something near or just mentioned",
    group: 1,
  },
  {
    rank: 20,
    word: "they",
    audioFile: "0020-they.mp3",
    zh: "他们；她们；它们",
    en: "people, animals, or things already mentioned",
    group: 1,
  },
];

/** Words with definitions + audio available for the live quiz. */
export const ACTIVE_VOCAB_WORDS = MANDARIN_VOCAB_WORDS.filter(
  (w) => w.zh.length > 0 && w.en.length > 0 && w.audioFile.length > 0,
);

export function audioUrl(audioFile: string): string {
  return `${AUDIO_BASE}/${audioFile}`;
}

export function groupForRank(rank: number): number {
  return Math.ceil(rank / GROUP_SIZE);
}

export function ranksInGroup(group: number): { start: number; end: number } {
  const start = (group - 1) * GROUP_SIZE + 1;
  const end = group * GROUP_SIZE;
  return { start, end };
}

export function slugifyWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function expectedAudioFile(rank: number, word: string): string {
  const n = String(rank).padStart(4, "0");
  return `${n}-${slugifyWord(word)}.mp3`;
}

export const MODE_LABELS: Record<DifficultyMode, string> = {
  mandarin: "听音选中文 · 7 pts",
  english: "English definition · 10 pts",
  easy: "看单词选中文 · 3 pts",
};

export const MODE_BASE_POINTS: Record<DifficultyMode, number> = {
  mandarin: 7,
  english: 10,
  easy: 3,
};
