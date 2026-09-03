import type { JapaneseWord } from "../types";
import { getJapaneseBlock, getPlayableBlockNumbers } from "./index";

export type JapaneseCatalogEntry = {
  blockNumber: number;
  wordIndex: number;
  word: JapaneseWord;
  romajiKey: string;
  englishKey: string;
  /** Blocks that share this romaji, including this one. */
  sameRomajiBlocks: number[];
  /** Blocks that share this exact English gloss, including this one. */
  sameEnglishBlocks: number[];
  isRomajiRepeat: boolean;
  isEnglishRepeat: boolean;
  /** Same romaji appears with more than one Japanese writing. */
  romajiClash: boolean;
};

export type JapaneseCatalogSummary = {
  total: number;
  blockCount: number;
  uniqueRomaji: number;
  uniqueEnglish: number;
  repeatedRomajiCount: number;
  repeatedRomajiSlots: number;
};

export type JapaneseRomajiGroup = {
  romajiKey: string;
  displayRomaji: string;
  entries: JapaneseCatalogEntry[];
  romajiClash: boolean;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function buildCatalog(): JapaneseCatalogEntry[] {
  const raw: Array<{
    blockNumber: number;
    wordIndex: number;
    word: JapaneseWord;
    romajiKey: string;
    englishKey: string;
  }> = [];

  for (const blockNumber of getPlayableBlockNumbers()) {
    const words = getJapaneseBlock(blockNumber);
    words.forEach((word, wordIndex) => {
      raw.push({
        blockNumber,
        wordIndex,
        word,
        romajiKey: normalizeKey(word.r),
        englishKey: normalizeKey(word.en),
      });
    });
  }

  const blocksByRomaji = new Map<string, number[]>();
  const jpByRomaji = new Map<string, Set<string>>();
  const blocksByEnglish = new Map<string, number[]>();

  for (const item of raw) {
    const romajiBlocks = blocksByRomaji.get(item.romajiKey) ?? [];
    romajiBlocks.push(item.blockNumber);
    blocksByRomaji.set(item.romajiKey, romajiBlocks);

    const writings = jpByRomaji.get(item.romajiKey) ?? new Set<string>();
    writings.add(item.word.jp.trim());
    jpByRomaji.set(item.romajiKey, writings);

    const englishBlocks = blocksByEnglish.get(item.englishKey) ?? [];
    englishBlocks.push(item.blockNumber);
    blocksByEnglish.set(item.englishKey, englishBlocks);
  }

  return raw.map((item) => {
    const sameRomajiBlocks = uniqueSorted(blocksByRomaji.get(item.romajiKey) ?? []);
    const sameEnglishBlocks = uniqueSorted(blocksByEnglish.get(item.englishKey) ?? []);
    const writings = jpByRomaji.get(item.romajiKey);
    return {
      ...item,
      sameRomajiBlocks,
      sameEnglishBlocks,
      isRomajiRepeat: sameRomajiBlocks.length > 1,
      isEnglishRepeat: sameEnglishBlocks.length > 1,
      romajiClash: (writings?.size ?? 0) > 1,
    };
  });
}

let cachedCatalog: JapaneseCatalogEntry[] | null = null;

export function getJapaneseCatalog(): JapaneseCatalogEntry[] {
  if (!cachedCatalog) cachedCatalog = buildCatalog();
  return cachedCatalog;
}

export function summarizeJapaneseCatalog(
  entries: JapaneseCatalogEntry[] = getJapaneseCatalog(),
): JapaneseCatalogSummary {
  const romajiKeys = new Set<string>();
  const englishKeys = new Set<string>();
  const repeatedRomaji = new Set<string>();
  const blocks = new Set<number>();
  let repeatedRomajiSlots = 0;

  for (const entry of entries) {
    romajiKeys.add(entry.romajiKey);
    englishKeys.add(entry.englishKey);
    blocks.add(entry.blockNumber);
    if (entry.isRomajiRepeat) {
      repeatedRomaji.add(entry.romajiKey);
      repeatedRomajiSlots += 1;
    }
  }

  return {
    total: entries.length,
    blockCount: blocks.size,
    uniqueRomaji: romajiKeys.size,
    uniqueEnglish: englishKeys.size,
    repeatedRomajiCount: repeatedRomaji.size,
    repeatedRomajiSlots,
  };
}

export function catalogEntriesForBlock(
  blockNumber: number,
  entries: JapaneseCatalogEntry[] = getJapaneseCatalog(),
): JapaneseCatalogEntry[] {
  return entries.filter((entry) => entry.blockNumber === blockNumber);
}

export function groupRepeatedRomaji(
  entries: JapaneseCatalogEntry[],
): JapaneseRomajiGroup[] {
  const groups = new Map<string, JapaneseCatalogEntry[]>();
  for (const entry of entries) {
    if (!entry.isRomajiRepeat) continue;
    const list = groups.get(entry.romajiKey) ?? [];
    list.push(entry);
    groups.set(entry.romajiKey, list);
  }

  return [...groups.entries()]
    .map(([romajiKey, groupEntries]) => {
      const sorted = [...groupEntries].sort(
        (a, b) => a.blockNumber - b.blockNumber || a.wordIndex - b.wordIndex,
      );
      return {
        romajiKey,
        displayRomaji: sorted[0]?.word.r ?? romajiKey,
        entries: sorted,
        romajiClash: sorted.some((entry) => entry.romajiClash),
      };
    })
    .sort(
      (a, b) =>
        b.entries.length - a.entries.length ||
        a.displayRomaji.localeCompare(b.displayRomaji),
    );
}

export function catalogEntryMatchesQuery(
  entry: JapaneseCatalogEntry,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const blockNeedle = needle.replace(/^block\s+/, "b");
  return (
    entry.word.r.toLowerCase().includes(needle) ||
    entry.word.en.toLowerCase().includes(needle) ||
    entry.word.jp.includes(query.trim()) ||
    `b${entry.blockNumber}` === blockNeedle ||
    String(entry.blockNumber) === needle
  );
}

export function otherBlocksLabel(entry: JapaneseCatalogEntry): string | null {
  const others = entry.sameRomajiBlocks.filter((n) => n !== entry.blockNumber);
  if (others.length === 0) return null;
  return others.map((n) => `B${n}`).join(", ");
}
