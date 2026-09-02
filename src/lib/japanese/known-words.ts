export type KnownWordProgress = {
  known: boolean;
  missedEarlyRounds: boolean;
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
  round4CorrectCount: 0,
  round5CorrectCount: 0,
};

function toKnownSet(knownIndices: ReadonlySet<number> | readonly number[]): Set<number> {
  return knownIndices instanceof Set ? knownIndices : new Set(knownIndices);
}

export function buildPracticeOrder(
  wordCount: number,
  knownIndices: ReadonlySet<number> | readonly number[],
  isRetry: boolean,
): number[] {
  const all = Array.from({ length: wordCount }, (_, i) => i);
  if (!isRetry) return all;
  const known = toKnownSet(knownIndices);
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
  return Math.round(((knownCount + roundScore) / wordCount) * 100);
}

export function computeFormalRoundScorePct(
  roundScore: number,
  orderLen: number,
  wordCount: number,
  knownIndices: ReadonlySet<number> | readonly number[],
  isRetry: boolean,
): number {
  if (orderLen === 0) return 100;
  const known = toKnownSet(knownIndices);
  const knownCount = isRetry ? countKnownWords(known, wordCount) : 0;
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
  round4CorrectCount?: number;
  round5CorrectCount?: number;
}): KnownWordProgress {
  return {
    known: !!row.known,
    missedEarlyRounds: !!row.missedEarlyRounds,
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
      round4CorrectCount: 0,
      round5CorrectCount: 0,
    };
  }

  let { round4CorrectCount, round5CorrectCount, missedEarlyRounds } = prev;
  if (round === 4) round4CorrectCount += 1;
  if (round === 5) round5CorrectCount += 1;

  const known =
    !missedEarlyRounds && round4CorrectCount >= 1 && round5CorrectCount >= 1;

  return {
    known,
    missedEarlyRounds,
    round4CorrectCount,
    round5CorrectCount,
  };
}
