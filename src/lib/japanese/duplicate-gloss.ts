import type { JapaneseWord } from "./types";
import block1 from "./blocks/block1.json";
import block2 from "./blocks/block2.json";
import block3 from "./blocks/block3.json";
import block4 from "./blocks/block4.json";
import block5 from "./blocks/block5.json";
import block6 from "./blocks/block6.json";
import block7 from "./blocks/block7.json";
import block8 from "./blocks/block8.json";
import block9 from "./blocks/block9.json";
import block10 from "./blocks/block10.json";

export type VocabWordRef = JapaneseWord & { block: number };

const ALL_BLOCKS: Record<number, JapaneseWord[]> = {
  1: block1 as JapaneseWord[],
  2: block2 as JapaneseWord[],
  3: block3 as JapaneseWord[],
  4: block4 as JapaneseWord[],
  5: block5 as JapaneseWord[],
  6: block6 as JapaneseWord[],
  7: block7 as JapaneseWord[],
  8: block8 as JapaneseWord[],
  9: block9 as JapaneseWord[],
  10: block10 as JapaneseWord[],
};

/** Strip fluff so "excuse me / sorry" and "sorry (casual)" share token "sorry". */
export function tokenizeEnglishGloss(en: string): string[] {
  const tokens = new Set<string>();
  for (const part of en.toLowerCase().split("/")) {
    for (const chunk of part.split(/[,;]/)) {
      let t = chunk
        .trim()
        .replace(/\([^)]*\)/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      t = t.replace(/^(a|an|the|to|be)\s+/i, "").trim();
      if (t.length >= 2) tokens.add(t);
    }
  }
  return [...tokens];
}

export function getAllVocabWords(): VocabWordRef[] {
  const out: VocabWordRef[] = [];
  for (const [block, words] of Object.entries(ALL_BLOCKS)) {
    for (const w of words) {
      out.push({ ...w, block: Number(block) });
    }
  }
  return out;
}

export type DuplicateGlossGroup = {
  /** Primary shared gloss token, e.g. "maybe". */
  token: string;
  words: VocabWordRef[];
};

/** Groups of 2+ distinct romaji sharing any gloss token across all loaded blocks. */
export function findDuplicateGlossGroups(): DuplicateGlossGroup[] {
  const byToken = new Map<string, Map<string, VocabWordRef>>();

  for (const word of getAllVocabWords()) {
    for (const token of tokenizeEnglishGloss(word.en)) {
      if (!byToken.has(token)) byToken.set(token, new Map());
      byToken.get(token)!.set(word.r, word);
    }
  }

  const groups: DuplicateGlossGroup[] = [];
  for (const [token, romajiMap] of byToken) {
    const words = [...romajiMap.values()];
    if (words.length >= 2) {
      groups.push({ token, words: words.sort((a, b) => a.r.localeCompare(b.r)) });
    }
  }

  return groups.sort((a, b) => b.words.length - a.words.length || a.token.localeCompare(b.token));
}

/** True when this word shares a gloss token with another word in the full vocab set. */
export function wordHasDuplicateGloss(word: JapaneseWord): boolean {
  const tokens = tokenizeEnglishGloss(word.en);
  const all = getAllVocabWords().filter((w) => w.r !== word.r);
  return tokens.some((token) =>
    all.some((other) => tokenizeEnglishGloss(other.en).includes(token)),
  );
}
