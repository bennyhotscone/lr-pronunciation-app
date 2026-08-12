/** Sort target vocab: commonality (frequency rank) then lookupCount then recent. */
export type VocabSortable = {
  frequencyRank: number | null;
  lookupCount: number;
  lastLookupAt: Date | string;
};

export function compareVocabEntries(a: VocabSortable, b: VocabSortable): number {
  const aRank = a.frequencyRank;
  const bRank = b.frequencyRank;
  if (aRank != null && bRank != null && aRank !== bRank) return aRank - bRank;
  if (aRank != null && bRank == null) return -1;
  if (aRank == null && bRank != null) return 1;
  if (b.lookupCount !== a.lookupCount) return b.lookupCount - a.lookupCount;
  const aT = typeof a.lastLookupAt === "string" ? Date.parse(a.lastLookupAt) : a.lastLookupAt.getTime();
  const bT = typeof b.lastLookupAt === "string" ? Date.parse(b.lastLookupAt) : b.lastLookupAt.getTime();
  return bT - aT;
}
