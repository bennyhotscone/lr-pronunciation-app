import { JAPANESE_KNOWN_THRESHOLD } from "./config";

export type KnownWordProgress = {
  known: boolean;
  missedEarlyRounds: boolean;
  consecutiveCorrect: number;
  round4CorrectCount: number;
  round5CorrectCount: number;
};

export type KnownWordsMap = Record<number, { known?: boolean }>;

/** Map persisted word stats into the shape expected by the training engine. */
export function statsToKnownWordsMap(
  stats: Record<number, { known?: boolean }>,
): KnownWordsMap {
  const map: KnownWordsMap = {};
  for (const [idx, stat] of Object.entries(stats)) {
    if (stat.known) map[Number(idx)] = { known: true };
  }
  return map;
}

export const EMPTY_KNOWN_PROGRESS: KnownWordProgress = {
  known: false,
  missedEarlyRounds: false,
  consecutiveCorrect: 0,
  round4CorrectCount: 0,
  round5CorrectCount: 0,
};

function toKnownSet(knownIndices: ReadonlySet<number> | readonly number[]): Set<number> {
  return knownIndices instanceof Set ? knownIndices : new Set(knownIndices);
}

/**
 * Build a practice queue, always skipping known / credit indices.
 * `isRetry` is kept for call-site compatibility; known words are never re-taught.
 */
export function buildPracticeOrder(
  wordCount: number,
  knownIndices: ReadonlySet<number> | readonly number[],
  _isRetry = true,
): number[] {
  const all = Array.from({ length: wordCount }, (_, i) => i);
  const known = toKnownSet(knownIndices);
  if (known.size === 0) return all;
  return all.filter((i) => !known.has(i));
}

export function getKnownIndices(knownWords: KnownWordsMap): number[] {
  return [...indicesFromKnownStats(knownWords)];
}

export function countKnownWords(knownIndices: ReadonlySet<number>, wordCount: number): number {
  let count = 0;
  for (let i = 0; i < wordCount; i++) {
    if (knownIndices.has(i)) count++;
  }
  return count;
}

export function computeRoundScorePct(
  roundScore: number,
  wordCount: number,
  knownCount: number,
): number {
  if (wordCount <= 0) return 100;
  // Mastery is current-block coverage only; never credit more than the remaining slots
  // (review/side-point corrects must not inflate past 100%).
  const creditedKnown = Math.min(Math.max(0, knownCount), wordCount);
  const remaining = wordCount - creditedKnown;
  const masteryCorrect = Math.min(Math.max(0, roundScore), remaining);
  return Math.min(100, Math.round(((creditedKnown + masteryCorrect) / wordCount) * 100));
}

export function computeFormalRoundScorePct(
  roundScore: number,
  orderLen: number,
  wordCount: number,
  knownIndices: ReadonlySet<number> | readonly number[],
  _isRetry = true,
): number {
  if (orderLen === 0) return 100;
  const known = toKnownSet(knownIndices);
  const knownCount = countKnownWords(known, wordCount);
  return computeRoundScorePct(roundScore, wordCount, knownCount);
}

export function skipKnownIntroIndex(
  index: number,
  wordCount: number,
  knownIndices: ReadonlySet<number>,
): number {
  let i = index;
  while (i < wordCount && knownIndices.has(i)) i++;
  return i;
}

export function indicesFromKnownStats(stats: KnownWordsMap): Set<number> {
  const known = new Set<number>();
  for (const [idx, stat] of Object.entries(stats)) {
    if (stat.known) known.add(Number(idx));
  }
  return known;
}

export function knownProgressFromDb(row: {
  known?: boolean;
  missedEarlyRounds?: boolean;
  consecutiveCorrect?: number;
  round4CorrectCount?: number;
  round5CorrectCount?: number;
}): KnownWordProgress {
  return {
    known: !!row.known,
    missedEarlyRounds: !!row.missedEarlyRounds,
    consecutiveCorrect: row.consecutiveCorrect ?? 0,
    round4CorrectCount: row.round4CorrectCount ?? 0,
    round5CorrectCount: row.round5CorrectCount ?? 0,
  };
}

export function applyAnswerToKnownProgress(
  prev: KnownWordProgress,
  round: 1 | 2 | 3 | 4 | 5,
  correct: boolean,
): KnownWordProgress {
  if (!correct) {
    return {
      known: false,
      missedEarlyRounds: prev.missedEarlyRounds || round <= 3,
      consecutiveCorrect: 0,
      round4CorrectCount: 0,
      round5CorrectCount: 0,
    };
  }

  let { consecutiveCorrect, round4CorrectCount, round5CorrectCount, missedEarlyRounds } = prev;
  if (round === 4) {
    round4CorrectCount += 1;
    consecutiveCorrect += 1;
  } else if (round === 5) {
    round5CorrectCount += 1;
    consecutiveCorrect += 1;
  }

  const known =
    !missedEarlyRounds &&
    (consecutiveCorrect >= JAPANESE_KNOWN_THRESHOLD ||
      (round4CorrectCount >= 1 && round5CorrectCount >= 1));

  return {
    known,
    missedEarlyRounds,
    consecutiveCorrect,
    round4CorrectCount,
    round5CorrectCount,
  };
}

/** True when a word should leave the active R4/R5 pool after this correct answer. */
export function shouldRetireWordAfterCorrect(
  prev: KnownWordProgress,
  round: 4 | 5,
  correct: boolean,
): boolean {
  if (!correct || (round !== 4 && round !== 5)) return false;
  const next = applyAnswerToKnownProgress(prev, round, true);
  return next.consecutiveCorrect >= JAPANESE_KNOWN_THRESHOLD;
}
