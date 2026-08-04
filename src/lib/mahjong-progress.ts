export const MAHJONG_SAVE_KEY = "lr-mandarin-mahjong-v1";

export type MahjongMatchMode = "audio-zh" | "word-zh";

export type MahjongProgressSaved = {
  mode: MahjongMatchMode;
  pairCount: number;
  wins: number;
  bestMoves: number | null;
  clearedRanks: number[];
};

const DEFAULT: MahjongProgressSaved = {
  mode: "audio-zh",
  pairCount: 6,
  wins: 0,
  bestMoves: null,
  clearedRanks: [],
};

export function loadMahjongProgress(): MahjongProgressSaved {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(MAHJONG_SAVE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<MahjongProgressSaved>;
    const mode: MahjongMatchMode =
      parsed.mode === "word-zh" || parsed.mode === "audio-zh"
        ? parsed.mode
        : "audio-zh";
    const pairCount =
      parsed.pairCount === 4 || parsed.pairCount === 6 || parsed.pairCount === 8
        ? parsed.pairCount
        : 6;
    return {
      mode,
      pairCount,
      wins: typeof parsed.wins === "number" ? parsed.wins : 0,
      bestMoves:
        typeof parsed.bestMoves === "number" && parsed.bestMoves > 0
          ? parsed.bestMoves
          : null,
      clearedRanks: Array.isArray(parsed.clearedRanks)
        ? parsed.clearedRanks.filter((n): n is number => typeof n === "number")
        : [],
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveMahjongProgress(state: MahjongProgressSaved): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MAHJONG_SAVE_KEY, JSON.stringify(state));
}
