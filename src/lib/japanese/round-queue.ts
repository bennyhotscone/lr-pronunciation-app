import { JAPANESE_PRIOR_REVIEW_CAP } from "./config";
import {
  catalogEntriesForBlock,
  getJapaneseCatalog,
  type JapaneseCatalogEntry,
} from "./blocks/catalog";
import { wordlistKnownKey } from "./wordlist-catalog";

/** Encoded order ids for previous-block review items (persist in session.order). */
export const REVIEW_ORDER_BASE = 10_000;

export type PriorLearning = {
  knownKeys: ReadonlySet<string>;
  seenKeys: ReadonlySet<string>;
  masteredBlocks: ReadonlySet<number>;
};

export type ResolvedQueueItem = {
  /** Value stored in session.order (current-block index or encoded review ref). */
  orderId: number;
  sourceBlock: number;
  sourceWordIndex: number;
  /** Earlier block this item is reviewing, if any. */
  reviewFromBlock: number | null;
  isExternalReview: boolean;
};

export function emptyPriorLearning(): PriorLearning {
  return {
    knownKeys: new Set(),
    seenKeys: new Set(),
    masteredBlocks: new Set(),
  };
}

export function priorLearningFromArrays(input?: {
  knownKeys?: readonly string[];
  seenKeys?: readonly string[];
  masteredBlocks?: readonly number[];
} | null): PriorLearning {
  if (!input) return emptyPriorLearning();
  return {
    knownKeys: new Set(input.knownKeys ?? []),
    seenKeys: new Set(input.seenKeys ?? []),
    masteredBlocks: new Set(input.masteredBlocks ?? []),
  };
}

function shuffleLocal<T>(items: T[]): T[] {
  const x = [...items];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function toSet(indices: ReadonlySet<number> | readonly number[]): Set<number> {
  return indices instanceof Set ? new Set(indices) : new Set(indices);
}

function isSameHeadword(a: JapaneseCatalogEntry, b: JapaneseCatalogEntry): boolean {
  if (a.romajiKey !== b.romajiKey) return false;
  if (a.romajiClash || b.romajiClash) {
    return a.englishKey === b.englishKey && a.word.jp.trim() === b.word.jp.trim();
  }
  return true;
}

export function catalogEntryAt(
  blockNumber: number,
  wordIndex: number,
): JapaneseCatalogEntry | null {
  return (
    catalogEntriesForBlock(blockNumber).find((entry) => entry.wordIndex === wordIndex) ?? null
  );
}

/** Earlier-block copies of the same headword (not romaji-clash different words). */
export function priorSameHeadwords(
  blockNumber: number,
  wordIndex: number,
): JapaneseCatalogEntry[] {
  const entry = catalogEntryAt(blockNumber, wordIndex);
  if (!entry) return [];
  return getJapaneseCatalog().filter(
    (other) =>
      other.blockNumber < blockNumber && isSameHeadword(entry, other),
  );
}

export function earliestPriorHeadwordBlock(
  blockNumber: number,
  wordIndex: number,
): number | null {
  const prior = priorSameHeadwords(blockNumber, wordIndex);
  if (prior.length === 0) return null;
  return Math.min(...prior.map((p) => p.blockNumber));
}

function priorWasTaught(prior: JapaneseCatalogEntry, learning: PriorLearning): boolean {
  const key = wordlistKnownKey(prior.blockNumber, prior.wordIndex);
  if (learning.knownKeys.has(key)) return true;
  if (learning.seenKeys.has(key)) return true;
  if (learning.masteredBlocks.has(prior.blockNumber)) return true;
  return false;
}

/** True when this current-block slot was already taught / known in an earlier block. */
export function isPriorTaughtHeadword(
  blockNumber: number,
  wordIndex: number,
  learning: PriorLearning,
): boolean {
  return priorSameHeadwords(blockNumber, wordIndex).some((p) => priorWasTaught(p, learning));
}

export function reviewFromBlockForWord(
  blockNumber: number,
  wordIndex: number,
  learning: PriorLearning,
): number | null {
  const taught = priorSameHeadwords(blockNumber, wordIndex).filter((p) =>
    priorWasTaught(p, learning),
  );
  if (taught.length === 0) return null;
  return Math.min(...taught.map((p) => p.blockNumber));
}

export function reviewBadgeLabel(fromBlock: number): string {
  return `Review · Block ${fromBlock}`;
}

export function encodeExternalReview(blockNumber: number, wordIndex: number): number {
  return REVIEW_ORDER_BASE + blockNumber * 100 + wordIndex;
}

export function decodeExternalReview(
  orderId: number,
): { blockNumber: number; wordIndex: number } | null {
  if (orderId < REVIEW_ORDER_BASE) return null;
  const n = orderId - REVIEW_ORDER_BASE;
  return { blockNumber: Math.floor(n / 100), wordIndex: n % 100 };
}

export function isExternalReviewOrderId(orderId: number): boolean {
  return orderId >= REVIEW_ORDER_BASE;
}

export function isCurrentBlockOrderId(orderId: number, wordCount: number): boolean {
  return Number.isInteger(orderId) && orderId >= 0 && orderId < wordCount;
}

/** Indices to skip entirely in Learn / Recognise / Listen (R1–R3). */
export function learnSkipIndices(
  blockNumber: number,
  wordCount: number,
  localKnown: ReadonlySet<number> | readonly number[],
  learning: PriorLearning,
): number[] {
  const known = toSet(localKnown);
  const out: number[] = [];
  for (let i = 0; i < wordCount; i++) {
    if (known.has(i) || isPriorTaughtHeadword(blockNumber, i, learning)) {
      out.push(i);
    }
  }
  return out;
}

/**
 * Indices that count toward mastery when skipped from teaching
 * (local known + prior-taught duplicates).
 */
export function masteryCreditIndices(
  blockNumber: number,
  wordCount: number,
  localKnown: ReadonlySet<number> | readonly number[],
  learning: PriorLearning,
): number[] {
  return learnSkipIndices(blockNumber, wordCount, localKnown, learning);
}

/** Current-block slots that may return as labeled review in R4/R5. */
export function inBlockReviewIndices(
  blockNumber: number,
  wordCount: number,
  learning: PriorLearning,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < wordCount; i++) {
    if (isPriorTaughtHeadword(blockNumber, i, learning)) out.push(i);
  }
  return out;
}

function currentBlockHeadwordKeys(blockNumber: number, wordCount: number): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < wordCount; i++) {
    const entry = catalogEntryAt(blockNumber, i);
    if (!entry) continue;
    keys.add(`${entry.romajiKey}|${entry.englishKey}|${entry.word.jp.trim()}`);
  }
  return keys;
}

function headwordKey(entry: JapaneseCatalogEntry): string {
  return `${entry.romajiKey}|${entry.englishKey}|${entry.word.jp.trim()}`;
}

/** Extra previous-block known words (not already slots in the current block). */
export function pickExternalReviewOrderIds(
  blockNumber: number,
  wordCount: number,
  learning: PriorLearning,
  alreadyPicked: number,
  cap = JAPANESE_PRIOR_REVIEW_CAP,
): number[] {
  const remaining = Math.max(0, cap - alreadyPicked);
  if (remaining === 0) return [];

  const currentKeys = currentBlockHeadwordKeys(blockNumber, wordCount);
  const catalog = getJapaneseCatalog();
  const candidates: number[] = [];

  for (const key of learning.knownKeys) {
    const [blockRaw, indexRaw] = key.split(":");
    const sourceBlock = Number(blockRaw);
    const wordIndex = Number(indexRaw);
    if (!Number.isInteger(sourceBlock) || !Number.isInteger(wordIndex)) continue;
    if (sourceBlock >= blockNumber || sourceBlock < 1) continue;
    const entry = catalog.find(
      (e) => e.blockNumber === sourceBlock && e.wordIndex === wordIndex,
    );
    if (!entry) continue;
    if (currentKeys.has(headwordKey(entry))) continue;
    candidates.push(encodeExternalReview(sourceBlock, wordIndex));
  }

  return shuffleLocal(candidates).slice(0, remaining);
}

/** R1–R3 practice queue: everything except skip indices. */
export function buildLearnQueue(
  wordCount: number,
  skipIndices: ReadonlySet<number> | readonly number[],
): number[] {
  const skip = toSet(skipIndices);
  return Array.from({ length: wordCount }, (_, i) => i).filter((i) => !skip.has(i));
}

/**
 * R4/R5 queue: current-block new/unknown words + capped prior-block review.
 * `skipIndices` should be local-known ∪ prior-taught (same as learn skip).
 */
export function buildReviewQueue(
  blockNumber: number,
  wordCount: number,
  skipIndices: ReadonlySet<number> | readonly number[],
  learning: PriorLearning,
  cap = JAPANESE_PRIOR_REVIEW_CAP,
): number[] {
  const skip = toSet(skipIndices);
  const main = Array.from({ length: wordCount }, (_, i) => i).filter((i) => !skip.has(i));
  const inBlockReview = shuffleLocal(
    inBlockReviewIndices(blockNumber, wordCount, learning).filter((i) => skip.has(i)),
  );
  const cappedInBlock = inBlockReview.slice(0, cap);
  const external = pickExternalReviewOrderIds(
    blockNumber,
    wordCount,
    learning,
    cappedInBlock.length,
    cap,
  );
  return [...main, ...cappedInBlock, ...external];
}

export function resolveQueueItem(
  orderId: number,
  currentBlock: number,
  wordCount: number,
  learning: PriorLearning = emptyPriorLearning(),
): ResolvedQueueItem {
  const decoded = decodeExternalReview(orderId);
  if (decoded) {
    return {
      orderId,
      sourceBlock: decoded.blockNumber,
      sourceWordIndex: decoded.wordIndex,
      reviewFromBlock: decoded.blockNumber,
      isExternalReview: true,
    };
  }

  const wordIndex = orderId;
  const reviewFrom =
    isCurrentBlockOrderId(wordIndex, wordCount)
      ? reviewFromBlockForWord(currentBlock, wordIndex, learning)
      : null;

  return {
    orderId,
    sourceBlock: currentBlock,
    sourceWordIndex: wordIndex,
    reviewFromBlock: reviewFrom,
    isExternalReview: false,
  };
}
/** True when this queue item is prior-block review side-points (not mastery). */
export function isBonusReviewItem(item: ResolvedQueueItem): boolean {
  return item.isExternalReview || item.reviewFromBlock != null;
}