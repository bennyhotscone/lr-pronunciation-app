export type WordlistFilter = "all" | "known" | "unknown";

export type WordlistCounts = {
  known: number;
  unknown: number;
  total: number;
};

export function wordlistKnownKey(blockNumber: number, wordIndex: number): string {
  return `${blockNumber}:${wordIndex}`;
}

export function isWordlistEntryKnown(
  entry: { blockNumber: number; wordIndex: number },
  knownKeys: ReadonlySet<string>,
): boolean {
  return knownKeys.has(wordlistKnownKey(entry.blockNumber, entry.wordIndex));
}

/** Overlay live stats for the open block onto fetched known keys from every block. */
export function mergeKnownKeys(
  fetchedKeys: readonly string[],
  blockNumber: number,
  wordCount: number,
  wordStats: Record<number, { known?: boolean }>,
): Set<string> {
  const keys = new Set(fetchedKeys);
  for (let i = 0; i < wordCount; i++) {
    const key = wordlistKnownKey(blockNumber, i);
    if (wordStats[i]?.known) keys.add(key);
    else keys.delete(key);
  }
  return keys;
}

export function countWordlist(
  rows: readonly { blockNumber: number; wordIndex: number }[],
  knownKeys: ReadonlySet<string>,
): WordlistCounts {
  let known = 0;
  for (const row of rows) {
    if (isWordlistEntryKnown(row, knownKeys)) known += 1;
  }
  return { known, unknown: rows.length - known, total: rows.length };
}

export function matchesKnownFilter(
  entry: { blockNumber: number; wordIndex: number },
  filter: WordlistFilter,
  knownKeys: ReadonlySet<string>,
): boolean {
  if (filter === "known") return isWordlistEntryKnown(entry, knownKeys);
  if (filter === "unknown") return !isWordlistEntryKnown(entry, knownKeys);
  return true;
}
