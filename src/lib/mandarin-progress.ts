import type { DifficultyMode } from "@/data/mandarin-vocab";

/** Bumped to v2 after correcting the ZIP's mislabeled ranks (duplicate "to" / "'s"). */
export const MANDARIN_SAVE_KEY = "lr-mandarin-progress-v2";

export type MandarinProgressSaved = {
  mode: DifficultyMode;
  idx: number;
  points: number;
  mastered: number[];
  /** Highest group the learner may study (1-based). Future: unlock after clearing prior group. */
  unlockedGroup?: number;
};

export function loadMandarinProgress(): MandarinProgressSaved {
  if (typeof window === "undefined") {
    return { mode: "mandarin", idx: 0, points: 0, mastered: [], unlockedGroup: 1 };
  }
  try {
    const raw = localStorage.getItem(MANDARIN_SAVE_KEY);
    if (!raw) {
      return { mode: "mandarin", idx: 0, points: 0, mastered: [], unlockedGroup: 1 };
    }
    const parsed = JSON.parse(raw) as Partial<MandarinProgressSaved>;
    const mode: DifficultyMode =
      parsed.mode === "english" || parsed.mode === "easy" || parsed.mode === "mandarin"
        ? parsed.mode
        : "mandarin";
    return {
      mode,
      idx: Number.isInteger(parsed.idx) ? (parsed.idx as number) : 0,
      points: typeof parsed.points === "number" ? parsed.points : 0,
      mastered: Array.isArray(parsed.mastered)
        ? parsed.mastered.filter((n): n is number => typeof n === "number")
        : [],
      unlockedGroup:
        typeof parsed.unlockedGroup === "number" && parsed.unlockedGroup >= 1
          ? parsed.unlockedGroup
          : 1,
    };
  } catch {
    return { mode: "mandarin", idx: 0, points: 0, mastered: [], unlockedGroup: 1 };
  }
}

export function saveMandarinProgress(state: MandarinProgressSaved): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MANDARIN_SAVE_KEY, JSON.stringify(state));
}

/** Group N unlocks when every rank in group N-1 is mastered (or N === 1). */
export function isGroupUnlocked(
  group: number,
  mastered: Set<number>,
  groupSize: number,
  unlockedGroup: number,
): boolean {
  if (group <= unlockedGroup) return true;
  if (group === 1) return true;
  const prevStart = (group - 2) * groupSize + 1;
  const prevEnd = (group - 1) * groupSize;
  for (let r = prevStart; r <= prevEnd; r++) {
    if (!mastered.has(r)) return false;
  }
  return true;
}
