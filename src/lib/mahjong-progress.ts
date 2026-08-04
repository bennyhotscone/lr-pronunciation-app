export const MAHJONG_SAVE_KEY = "lr-mandarin-mahjong-v3";

export type MahjongProgressSaved = {
  /** Frequency batch: 1 = ranks 1–50, 2 = 51–100 */
  batch: number;
  wins: number;
  bestMovesByBatch: Record<string, number>;
  /** Ranks the learner has successfully matched at least once */
  masteredRanks: number[];
};

const DEFAULT: MahjongProgressSaved = {
  batch: 1,
  wins: 0,
  bestMovesByBatch: {},
  masteredRanks: [],
};

export function loadMahjongProgress(): MahjongProgressSaved {
  if (typeof window === "undefined") return { ...DEFAULT, bestMovesByBatch: {} };
  try {
    // Prefer v3; migrate mastered ranks from memory-match v2 if present.
    const rawV3 = localStorage.getItem(MAHJONG_SAVE_KEY);
    const rawV2 = localStorage.getItem("lr-mandarin-mahjong-v2");
    const raw = rawV3 ?? rawV2;
    if (!raw) return { ...DEFAULT, bestMovesByBatch: {} };
    const parsed = JSON.parse(raw) as Partial<MahjongProgressSaved> & {
      pairCount?: number;
    };
    const batch =
      parsed.batch === 1 || parsed.batch === 2 ? parsed.batch : 1;
    return {
      batch,
      wins: typeof parsed.wins === "number" ? parsed.wins : 0,
      bestMovesByBatch:
        parsed.bestMovesByBatch && typeof parsed.bestMovesByBatch === "object"
          ? parsed.bestMovesByBatch
          : {},
      masteredRanks: Array.isArray(parsed.masteredRanks)
        ? parsed.masteredRanks.filter((n): n is number => typeof n === "number")
        : [],
    };
  } catch {
    return { ...DEFAULT, bestMovesByBatch: {} };
  }
}

export function saveMahjongProgress(state: MahjongProgressSaved): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MAHJONG_SAVE_KEY, JSON.stringify(state));
}
