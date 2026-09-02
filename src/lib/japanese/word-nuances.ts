import distinctionsData from "./word-nuance-distinctions.json";
import {
  findDuplicateGlossGroups,
  tokenizeEnglishGloss,
  type VocabWordRef,
} from "./duplicate-gloss";
import type { JapaneseWord } from "./types";

export type WordNuanceEntry = {
  romaji: string;
  jp: string;
  gloss: string;
  /** When to use this word — direct, learner-focused. */
  when: string;
};

export type WordNuanceGroup = {
  id: string;
  title: string;
  entries: WordNuanceEntry[];
};

type DistinctionGroupJson = {
  id: string;
  title: string;
  tokens?: string[];
  entries: WordNuanceEntry[];
};

const distinctionGroups = (distinctionsData as { groups: DistinctionGroupJson[] }).groups;

/** Curated groups from JSON — covers maybe, these, ask, leave, other, etc. */
export const WORD_NUANCE_GROUPS: WordNuanceGroup[] = distinctionGroups.map((g) => ({
  id: g.id,
  title: g.title,
  entries: g.entries,
}));

const entryByRomaji = new Map<string, { entry: WordNuanceEntry; group: WordNuanceGroup }>();
const groupByToken = new Map<string, WordNuanceGroup>();

for (const group of WORD_NUANCE_GROUPS) {
  const jsonGroup = distinctionGroups.find((g) => g.id === group.id);
  for (const token of jsonGroup?.tokens ?? []) {
    groupByToken.set(token, group);
  }
  for (const entry of group.entries) {
    entryByRomaji.set(entry.romaji, { entry, group });
    for (const token of tokenizeEnglishGloss(entry.gloss)) {
      if (!groupByToken.has(token)) groupByToken.set(token, group);
    }
  }
}

function fallbackWhen(word: VocabWordRef, siblings: VocabWordRef[]): string {
  const others = siblings
    .filter((s) => s.r !== word.r)
    .map((s) => `${s.r} (${s.en})`)
    .join("; ");
  return `Japanese uses several words for "${word.en.split("/")[0]?.trim()}". This is ${word.r}: ${word.en}.${others ? ` Compare: ${others}.` : ""}`;
}

function fallbackGroup(token: string, words: VocabWordRef[]): WordNuanceGroup {
  return {
    id: `auto-${token}`,
    title: `Why not just one word for "${token}"?`,
    entries: words.map((w) => ({
      romaji: w.r,
      jp: w.jp,
      gloss: w.en,
      when: fallbackWhen(w, words),
    })),
  };
}

/** All duplicate-gloss groups detected in loaded blocks (6 as of blocks 1–3). */
export function getDetectedDuplicateGlossGroups() {
  return findDuplicateGlossGroups();
}

export function getNuanceForWord(word: JapaneseWord): WordNuanceEntry | null {
  if (word.nuance?.trim()) {
    return {
      romaji: word.r,
      jp: word.jp,
      gloss: word.en,
      when: word.nuance.trim(),
    };
  }

  const curated = entryByRomaji.get(word.r);
  if (curated) return curated.entry;

  const tokens = tokenizeEnglishGloss(word.en);
  for (const dup of findDuplicateGlossGroups()) {
    if (!tokens.includes(dup.token)) continue;
    const self = dup.words.find((w) => w.r === word.r);
    if (self) {
      return {
        romaji: self.r,
        jp: self.jp,
        gloss: self.en,
        when: fallbackWhen(self, dup.words),
      };
    }
  }
  return null;
}

export function getNuanceGroupForWord(word: JapaneseWord): WordNuanceGroup | null {
  const curated = entryByRomaji.get(word.r);
  if (curated) return curated.group;

  for (const token of tokenizeEnglishGloss(word.en)) {
    const byToken = groupByToken.get(token);
    if (byToken?.entries.some((e) => e.romaji === word.r)) return byToken;
  }

  for (const dup of findDuplicateGlossGroups()) {
    if (dup.words.some((w) => w.r === word.r)) {
      for (const token of tokenizeEnglishGloss(word.en)) {
        const byToken = groupByToken.get(token);
        if (byToken) return byToken;
      }
      return fallbackGroup(dup.token, dup.words);
    }
  }
  return null;
}

export function getNuanceGroupForRomaji(romaji: string): WordNuanceGroup | null {
  return entryByRomaji.get(romaji)?.group ?? null;
}

/** True when word is part of a duplicate-gloss cluster (curated or auto-detected). */
export function wordHasNuanceExplanation(word: JapaneseWord): boolean {
  return getNuanceGroupForWord(word) !== null;
}

/** True when two words belong to the same nuance comparison group. */
export function wordsShareNuanceGroup(r1: string, r2: string): boolean {
  const g1 = entryByRomaji.get(r1)?.group.id ?? getNuanceGroupForRomaji(r1)?.id;
  const g2 = entryByRomaji.get(r2)?.group.id ?? getNuanceGroupForRomaji(r2)?.id;
  return Boolean(g1 && g2 && g1 === g2);
}
