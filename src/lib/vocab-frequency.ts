/**
 * English commonality ranks from the project frequency list
 * (scripts/words-all-5000.json — COCA-style lemmas used by Mandarin vocab).
 * Rank 1 = most common. Words absent from the list return null.
 */
import frequencyWords from "@/data/english-frequency-5000.json";

const RANK_BY_NORMALIZED = new Map<string, number>();

for (let i = 0; i < frequencyWords.length; i++) {
  const key = normalizeVocabWord(String(frequencyWords[i]));
  if (!key || RANK_BY_NORMALIZED.has(key)) continue;
  RANK_BY_NORMALIZED.set(key, i + 1);
}

export function normalizeVocabWord(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "")
    .replace(/'+/g, "'");
}

/** 1-based frequency rank, or null when the word is outside the top list. */
export function frequencyRankForWord(word: string): number | null {
  const key = normalizeVocabWord(word);
  if (!key) return null;
  return RANK_BY_NORMALIZED.get(key) ?? null;
}

export function frequencyListSize(): number {
  return RANK_BY_NORMALIZED.size;
}
