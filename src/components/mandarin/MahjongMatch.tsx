"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import {
  MAHJONG_BATCH_SIZE,
  wordsInMahjongBatch,
  wordsWithAudioInMahjongBatch,
  type MandarinVocabWord,
} from "@/data/mandarin-vocab";
import { useAudioOverrides } from "@/lib/audio-overrides-client";
import {
  loadMahjongMode,
  loadMahjongProgress,
  saveMahjongMode,
  saveMahjongProgress,
  type MahjongPlayMode,
} from "@/lib/mahjong-progress";
import {
  canMatch,
  freeMatchingPartnerIds,
  freeTileIds,
  hasValidMove,
  pickLayout,
  placeOnLayout,
  remixRemaining,
  shuffleSlots,
  type FaceSpec,
  type LayoutInfo,
  type SolitaireTile,
} from "@/lib/mahjong-solitaire";
import "./mahjong-match.css";

type Feedback = { kind: "ok" | "bad" | "hint"; text: string } | null;

const FEEDBACK_TOAST_MS = 4200;

type BurstParticle = {
  id: number;
  dx: number;
  dy: number;
  hue: number;
  size: number;
};

type MatchBurst = {
  key: number;
  x: number;
  y: number;
  particles: BurstParticle[];
};

type ScorePop = {
  key: number;
  x: number;
  y: number;
  label: string;
};

const MODE_META: Record<
  MahjongPlayMode,
  { title: string; short: string; pairDescription: string }
> = {
  "en-zh": {
    title: "English ↔ 中文",
    short: "English ↔ 中文",
    pairDescription: "English with its Mandarin gloss",
  },
  "audio-zh": {
    title: "Audio ↔ 中文",
    short: "Audio ↔ 中文",
    pairDescription: "spoken English audio with its Mandarin gloss",
  },
  "audio-en": {
    title: "Audio ↔ English",
    short: "Audio ↔ English",
    pairDescription: "spoken English audio with its English word tile",
  },
};

function needsAudioPool(mode: MahjongPlayMode): boolean {
  return mode === "audio-zh" || mode === "audio-en";
}

function refOf(rank: number): string {
  return `#${String(rank).padStart(4, "0")}`;
}

function pickWords(pool: MandarinVocabWord[], count: number): MandarinVocabWord[] {
  return shuffleSlots(pool).slice(0, Math.min(count, pool.length));
}

function buildFaces(
  words: MandarinVocabWord[],
  mode: MahjongPlayMode,
): FaceSpec[] {
  const faces: FaceSpec[] = [];
  for (const w of words) {
    const refLabel = refOf(w.rank);
    if (mode === "audio-zh" || mode === "audio-en") {
      faces.push({
        id: `${w.rank}-audio`,
        pairId: w.rank,
        face: "audio",
        label: w.word,
        refLabel,
        audioFile: w.audioFile,
      });
      if (mode === "audio-en") {
        faces.push({
          id: `${w.rank}-word`,
          pairId: w.rank,
          face: "word",
          label: w.word,
          refLabel,
        });
      } else {
        faces.push({
          id: `${w.rank}-zh`,
          pairId: w.rank,
          face: "zh",
          label: w.zh,
          refLabel,
        });
      }
    } else {
      faces.push({
        id: `${w.rank}-word`,
        pairId: w.rank,
        face: "word",
        label: w.word,
        refLabel,
      });
      faces.push({
        id: `${w.rank}-zh`,
        pairId: w.rank,
        face: "zh",
        label: w.zh,
        refLabel,
      });
    }
  }
  return faces;
}

function buildDeal(
  words: MandarinVocabWord[],
  mode: MahjongPlayMode,
  layout: LayoutInfo,
): SolitaireTile[] {
  return placeOnLayout(buildFaces(words, mode), layout.slots);
}

function batchLabel(batch: number): string {
  const start = (batch - 1) * MAHJONG_BATCH_SIZE + 1;
  const end = batch * MAHJONG_BATCH_SIZE;
  return `${start}–${end}`;
}

function modeHint(mode: MahjongPlayMode): string {
  if (mode === "audio-zh") {
    return "Click a free tile — Audio tiles play the word. Match ▶ Audio ↔ 中文.";
  }
  if (mode === "audio-en") {
    return "Click a free tile — Audio tiles play the word. Match ▶ Audio ↔ English.";
  }
  return "Click a free tile, then its English ↔ 中文 pair.";
}

function otherFaceLabel(
  face: SolitaireTile["face"],
  mode: MahjongPlayMode,
): string {
  if (mode === "audio-en") {
    return face === "audio" ? "English word" : "▶ audio";
  }
  if (mode === "audio-zh") {
    return face === "audio" ? "中文" : "▶ audio";
  }
  if (face === "zh") return "English word";
  return "中文";
}

function faceKindLong(face: SolitaireTile["face"]): string {
  if (face === "zh") return "中文";
  if (face === "audio") return "Audio";
  return "English";
}

function mismatchFeedback(
  a: SolitaireTile,
  b: SolitaireTile,
  mode: MahjongPlayMode,
  showRefs: boolean,
): string {
  if (a.face === b.face) {
    return showRefs
      ? `Same ${faceKindLong(a.face)} face · pick the matching ${otherFaceLabel(a.face, mode)} · ${a.refLabel} ≠ ${b.refLabel}`
      : `Same ${faceKindLong(a.face)} face · pick the matching ${otherFaceLabel(a.face, mode)}.`;
  }
  if (a.pairId === b.pairId) {
    return showRefs
      ? `Same Ref but wrong faces · ${a.refLabel}`
      : "Same word but wrong faces for this mode.";
  }
  return showRefs
    ? `Different words · ${a.refLabel} (${a.label}) ≠ ${b.refLabel} (${b.label})`
    : "Different words — try another free pair.";
}

function readShowRefsFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("dev") === "1";
  } catch {
    return false;
  }
}

function faceClass(face: SolitaireTile["face"]): string {
  if (face === "zh") return "is-zh";
  if (face === "audio") return "is-audio";
  return "is-en";
}

function faceKind(face: SolitaireTile["face"]): string {
  if (face === "zh") return "中文";
  if (face === "audio") return "Audio";
  return "EN";
}

function midpointOfTiles(
  a: SolitaireTile,
  b: SolitaireTile,
  layout: LayoutInfo,
  boardEl: HTMLElement | null,
): { x: number; y: number } {
  if (!boardEl) return { x: 50, y: 40 };
  const rect = boardEl.getBoundingClientRect();
  const cols = layout.bounds.maxX - layout.bounds.minX + 1;
  const rows = layout.bounds.maxY - layout.bounds.minY + 1;
  const tileCenter = (t: SolitaireTile) => {
    const nx = (t.x - layout.bounds.minX + 0.5) / cols;
    const ny = (t.y - layout.bounds.minY + 0.5) / rows;
    return { x: nx * rect.width, y: ny * rect.height };
  };
  const pa = tileCenter(a);
  const pb = tileCenter(b);
  return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
}

function makeBurstParticles(): BurstParticle[] {
  return Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.35;
    const dist = 28 + Math.random() * 42;
    return {
      id: i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 8,
      hue: [42, 38, 28, 48][i % 4]!,
      size: 4 + Math.random() * 4,
    };
  });
}

export function MahjongMatch() {
  const lockRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const burstKeyRef = useRef(0);
  const { resolveUrl } = useAudioOverrides();
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<MahjongPlayMode>("en-zh");
  const [batch, setBatch] = useState(1);
  const [tiles, setTiles] = useState<SolitaireTile[]>([]);
  const [layout, setLayout] = useState<LayoutInfo>(() => pickLayout(18));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(() => new Set());
  const [matchingIds, setMatchingIds] = useState<Set<string>>(() => new Set());
  const [moves, setMoves] = useState(0);
  const [dealKey, setDealKey] = useState(0);
  const [wins, setWins] = useState(0);
  const [bestMovesByBatch, setBestMovesByBatch] = useState<Record<string, number>>(
    {},
  );
  const [masteredRanks, setMasteredRanks] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [toastPulse, setToastPulse] = useState(0);
  const [won, setWon] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [showRefs, setShowRefs] = useState(false);
  const [showDragon, setShowDragon] = useState(false);
  const [audioPoolSize, setAudioPoolSize] = useState(0);
  const [bursts, setBursts] = useState<MatchBurst[]>([]);
  const [scorePops, setScorePops] = useState<ScorePop[]>([]);
  const feedbackTimerRef = useRef<number | null>(null);
  const feedbackGenRef = useRef(0);

  const masteredSet = useMemo(() => new Set(masteredRanks), [masteredRanks]);

  const pushFeedback = useCallback((next: Feedback) => {
    const gen = ++feedbackGenRef.current;
    setFeedback(next);
    setToastPulse((n) => n + 1);
    if (feedbackTimerRef.current != null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    if (next && next.kind !== "hint") {
      feedbackTimerRef.current = window.setTimeout(() => {
        if (feedbackGenRef.current === gen) setFeedback(null);
        feedbackTimerRef.current = null;
      }, FEEDBACK_TOAST_MS);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current != null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const batch1Mastered = useMemo(() => {
    const g1 = wordsInMahjongBatch(1);
    return g1.length > 0 && g1.every((w) => masteredSet.has(w.rank));
  }, [masteredSet]);

  const batchProgress = useMemo(() => {
    const batchPool = wordsInMahjongBatch(batch);
    const done = batchPool.filter((w) => masteredSet.has(w.rank)).length;
    return { done, total: batchPool.length };
  }, [batch, masteredSet]);

  const freeIds = useMemo(() => freeTileIds(tiles), [tiles]);

  const selectedTile = useMemo(
    () => (selectedId ? tiles.find((t) => t.id === selectedId) : undefined),
    [selectedId, tiles],
  );

  const partnerIds = useMemo(
    () => freeMatchingPartnerIds(selectedTile, tiles),
    [selectedTile, tiles],
  );

  const remainingPairs = useMemo(
    () => tiles.filter((t) => !t.removed).length / 2,
    [tiles],
  );

  const stuck = useMemo(() => {
    if (won || tiles.length === 0) return false;
    const left = tiles.some((t) => !t.removed);
    return left && !hasValidMove(tiles);
  }, [tiles, won]);

  const playAudio = useCallback(
    (rank?: number, file?: string) => {
      if (!file || rank == null) return;
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        const el = new Audio(resolveUrl(rank, file));
        audioRef.current = el;
        void el.play().catch(() => {
          /* autoplay policies / missing file */
        });
      } catch {
        /* ignore */
      }
    },
    [resolveUrl],
  );

  const triggerDragon = useCallback(() => {
    setShowDragon(true);
    window.setTimeout(() => setShowDragon(false), 1200);
  }, []);

  const celebrateMatch = useCallback(
    (a: SolitaireTile, b: SolitaireTile, scoreLabel: string) => {
      const mid = midpointOfTiles(a, b, layout, boardRef.current);
      const key = ++burstKeyRef.current;
      setBursts((prev) => [
        ...prev.slice(-3),
        { key, x: mid.x, y: mid.y, particles: makeBurstParticles() },
      ]);
      setScorePops((prev) => [
        ...prev.slice(-3),
        { key, x: mid.x, y: mid.y, label: scoreLabel },
      ]);
      window.setTimeout(() => {
        setBursts((prev) => prev.filter((p) => p.key !== key));
        setScorePops((prev) => prev.filter((p) => p.key !== key));
      }, 780);
      if (Math.random() < 0.28) triggerDragon();
    },
    [layout, triggerDragon],
  );

  const deal = useCallback(
    (nextBatch: number, nextMode: MahjongPlayMode) => {
      lockRef.current = false;
      const wordsPool = needsAudioPool(nextMode)
        ? wordsWithAudioInMahjongBatch(nextBatch)
        : wordsInMahjongBatch(nextBatch);
      setAudioPoolSize(wordsPool.length);
      const nextLayout = pickLayout(wordsPool.length);
      const words = pickWords(wordsPool, nextLayout.pairCount);
      setLayout(nextLayout);
      setTiles(buildDeal(words, nextMode, nextLayout));
      setSelectedId(null);
      setSelectedRef(null);
      setWrongIds(new Set());
      setMatchingIds(new Set());
      setBursts([]);
      setScorePops([]);
      setMoves(0);
      pushFeedback({ kind: "hint", text: modeHint(nextMode) });
      setWon(false);
      setDealKey((k) => k + 1);
      if (Math.random() < 0.35) triggerDragon();
    },
    [pushFeedback, triggerDragon],
  );

  useEffect(() => {
    setShowRefs(readShowRefsFlag());
    const saved = loadMahjongProgress();
    const savedMode = loadMahjongMode();
    const startBatch =
      saved.batch === 2 &&
      wordsInMahjongBatch(1).every((w) => saved.masteredRanks.includes(w.rank))
        ? 2
        : saved.batch === 2
          ? 1
          : saved.batch;
    setBatch(startBatch);
    setMode(savedMode);
    setWins(saved.wins);
    setBestMovesByBatch(saved.bestMovesByBatch);
    setMasteredRanks(saved.masteredRanks);
    deal(startBatch, savedMode);
    setHydrated(true);
  }, [deal]);

  const persist = useCallback(
    (next: Partial<{
      batch: number;
      wins: number;
      bestMovesByBatch: Record<string, number>;
      masteredRanks: number[];
    }>) => {
      saveMahjongProgress({
        batch: next.batch ?? batch,
        wins: next.wins ?? wins,
        bestMovesByBatch: next.bestMovesByBatch ?? bestMovesByBatch,
        masteredRanks: next.masteredRanks ?? masteredRanks,
      });
    },
    [batch, wins, bestMovesByBatch, masteredRanks],
  );

  const remix = useCallback(() => {
    if (lockRef.current || won) return;
    lockRef.current = true;
    setSelectedId(null);
    setSelectedRef(null);
    setWrongIds(new Set());
    setMatchingIds(new Set());
    setTiles((prev) => {
      let next = remixRemaining(prev);
      // Retry a few shuffles if still stuck (rare).
      for (let i = 0; i < 8 && !hasValidMove(next) && next.some((t) => !t.removed); i++) {
        next = remixRemaining(next);
      }
      return next;
    });
    setDealKey((k) => k + 1);
    pushFeedback({
      kind: "hint",
      text: "Remixed remaining tiles — same words, new positions.",
    });
    lockRef.current = false;
  }, [pushFeedback, won]);

  const onTileClick = (tile: SolitaireTile) => {
    if (won || tile.removed) return;
    if (lockRef.current) {
      pushFeedback({
        kind: "hint",
        text: "Wait for the previous match to finish…",
      });
      return;
    }
    if (!freeIds.has(tile.id)) {
      pushFeedback({
        kind: "bad",
        text: "Tile locked — need open left or right, and nothing stacked on top.",
      });
      return;
    }

    if (tile.face === "audio") {
      playAudio(tile.pairId, tile.audioFile);
    }

    if (!selectedId) {
      setSelectedId(tile.id);
      setSelectedRef(tile.refLabel);
      pushFeedback({
        kind: "hint",
        text: showRefs
          ? `Selected ${tile.refLabel} · needs pair: ${otherFaceLabel(tile.face, mode)}`
          : `Selected · needs pair: ${otherFaceLabel(tile.face, mode)}`,
      });
      return;
    }

    if (selectedId === tile.id) {
      setSelectedId(null);
      setSelectedRef(null);
      pushFeedback({ kind: "hint", text: "Selection cleared." });
      return;
    }

    const a = tiles.find((t) => t.id === selectedId);
    const b = tile;
    if (!a || a.removed) {
      setSelectedId(tile.id);
      setSelectedRef(tile.refLabel);
      pushFeedback({
        kind: "hint",
        text: showRefs
          ? `Selected ${tile.refLabel} · needs pair: ${otherFaceLabel(tile.face, mode)}`
          : `Selected · needs pair: ${otherFaceLabel(tile.face, mode)}`,
      });
      return;
    }

    const moveCount = moves + 1;
    setMoves(moveCount);

    if (canMatch(a, b)) {
      lockRef.current = true;
      setMatchingIds(new Set([a.id, b.id]));
      pushFeedback({
        kind: "ok",
        text: showRefs ? `Match · ${a.refLabel} (${a.label})` : `Match · ${a.label}`,
      });
      setSelectedId(null);
      setSelectedRef(null);
      celebrateMatch(a, b, showRefs ? `+1 · ${a.refLabel}` : "+1");

      window.setTimeout(() => {
        setTiles((prev) => {
          const nextTiles = prev.map((t) =>
            t.id === a.id || t.id === b.id ? { ...t, removed: true } : t,
          );
          const cleared = nextTiles.every((t) => t.removed);

          setMasteredRanks((cr) => {
            const nextMastered = cr.includes(a.pairId)
              ? cr
              : [...cr, a.pairId].sort((x, y) => x - y);

            if (cleared) {
              const key = String(batch);
              setWon(true);
              triggerDragon();
              setWins((w) => {
                const nextWins = w + 1;
                setBestMovesByBatch((bm) => {
                  const prevBest = bm[key];
                  const nextBest =
                    prevBest == null ? moveCount : Math.min(prevBest, moveCount);
                  const nextBm = { ...bm, [key]: nextBest };
                  saveMahjongProgress({
                    batch,
                    wins: nextWins,
                    bestMovesByBatch: nextBm,
                    masteredRanks: nextMastered,
                  });
                  return nextBm;
                });
                return nextWins;
              });
              pushFeedback({ kind: "ok", text: "Board cleared!" });
            } else if (!cr.includes(a.pairId)) {
              saveMahjongProgress({
                batch,
                wins,
                bestMovesByBatch,
                masteredRanks: nextMastered,
              });
            }
            return nextMastered;
          });

          return nextTiles;
        });
        setMatchingIds(new Set());
        lockRef.current = false;
      }, 560);
    } else {
      lockRef.current = true;
      setWrongIds(new Set([a.id, b.id]));
      pushFeedback({
        kind: "bad",
        text: mismatchFeedback(a, b, mode, showRefs),
      });
      window.setTimeout(() => {
        setWrongIds(new Set());
        setSelectedId(b.id);
        setSelectedRef(b.refLabel);
        pushFeedback({
          kind: "hint",
          text: showRefs
            ? `Selected ${b.refLabel} · needs pair: ${otherFaceLabel(b.face, mode)}`
            : `Selected · needs pair: ${otherFaceLabel(b.face, mode)}`,
        });
        lockRef.current = false;
      }, 520);
    }
  };

  const selectBatch = (next: number) => {
    if (next === 2 && !batch1Mastered) return;
    setBatch(next);
    persist({ batch: next });
    deal(next, mode);
  };

  const selectMode = (next: MahjongPlayMode) => {
    if (next === mode) return;
    setMode(next);
    saveMahjongMode(next);
    deal(batch, next);
  };

  if (!hydrated) {
    return (
      <div className="mahjong-match">
        <p className="mj-loading">Dealing the tiles…</p>
      </div>
    );
  }

  const best = bestMovesByBatch[String(batch)];
  const cols = layout.bounds.maxX - layout.bounds.minX + 1;
  const rows = layout.bounds.maxY - layout.bounds.minY + 1;
  const modeTitle = MODE_META[mode].title;
  const audioHonest = needsAudioPool(mode)
    ? audioPoolSize < MAHJONG_BATCH_SIZE
      ? ` · ${audioPoolSize}/${MAHJONG_BATCH_SIZE} with audio in this group`
      : ` · ${layout.pairCount} audio pairs on board`
    : ` · ${layout.pairCount} pairs`;

  return (
    <div className="mahjong-match">
      <section className="mj-hero" aria-labelledby="mj-title">
        <p className="mj-chip">
          Mahjong Solitaire · {modeTitle}
          {showRefs ? " · Dev Refs" : ""}
        </p>
        <h1 id="mj-title" className="mj-title">
          Clear the table
        </h1>
        <p className="mj-lede">
          Stacked tiles — only free ones (nothing on top, open on left or right)
          can be selected. Match {MODE_META[mode].pairDescription}. Master all{" "}
          {MAHJONG_BATCH_SIZE} words in group 1 to unlock group 2.
          {audioHonest}.
        </p>

        <div className="mj-toolbar" role="group" aria-label="Play mode">
          {(Object.keys(MODE_META) as MahjongPlayMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`mj-btn mj-btn-ghost ${mode === m ? "is-active" : ""}`}
              onClick={() => selectMode(m)}
            >
              {MODE_META[m].short}
            </button>
          ))}
        </div>

        <div className="mj-toolbar" role="group" aria-label="Frequency group">
          <button
            type="button"
            className={`mj-btn mj-btn-ghost ${batch === 1 ? "is-active" : ""}`}
            onClick={() => selectBatch(1)}
          >
            Group 1 · {batchLabel(1)}
          </button>
          <button
            type="button"
            className={`mj-btn mj-btn-ghost ${batch === 2 ? "is-active" : ""}`}
            onClick={() => selectBatch(2)}
            disabled={!batch1Mastered}
            title={
              batch1Mastered
                ? `Play ranks ${batchLabel(2)}`
                : "Master all 50 words in group 1 first"
            }
          >
            Group 2 · {batchLabel(2)}
            {batch1Mastered ? "" : " · locked"}
          </button>
          <button
            type="button"
            className="mj-btn mj-btn-ghost"
            onClick={remix}
            disabled={won || remainingPairs === 0}
            title="Reshuffle remaining tiles to unlock new pairs"
          >
            Remix tiles
          </button>
          <button
            type="button"
            className="mj-btn mj-btn-primary"
            onClick={() => deal(batch, mode)}
          >
            New deal
          </button>
        </div>

        <div className="mj-stats">
          <div className="mj-stat">
            <div className="mj-stat-val">{moves}</div>
            <div className="mj-stat-label">Moves</div>
          </div>
          <div className="mj-stat">
            <div className="mj-stat-val">
              {batchProgress.done}/{batchProgress.total}
            </div>
            <div className="mj-stat-label">Mastered</div>
          </div>
          <div className="mj-stat">
            <div className="mj-stat-val">{best ?? "—"}</div>
            <div className="mj-stat-label">Best clear</div>
          </div>
          {showRefs ? (
            <div className="mj-stat mj-stat-ref" aria-live="polite">
              <div className="mj-stat-val mj-stat-ref-val">
                {selectedRef ?? "—"}
              </div>
              <div className="mj-stat-label">Ref</div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="mj-table-wrap">
        {feedback ? (
          <div
            key={toastPulse}
            className={`mj-toast is-${feedback.kind}`}
            role="status"
            aria-live="assertive"
          >
            {feedback.text}
          </div>
        ) : null}
        <div className="mj-table" aria-label="Mahjong solitaire board">
          {showDragon ? (
            <div className="mj-dragon" aria-hidden="true">
              <svg viewBox="0 0 120 48" className="mj-dragon-svg">
                <path
                  className="mj-dragon-path"
                  d="M8 30c8-14 18-18 28-12 6 4 8 4 14-2 8-8 16-8 24-2 6 4 10 6 18 4 8-2 14 2 20 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx="104" cy="28" r="3.2" fill="currentColor" />
                <path
                  d="M96 18c4 2 8 6 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          ) : null}
          <div
            className="mj-board"
            key={dealKey}
            ref={boardRef}
            style={
              {
                "--mj-cols": cols,
                "--mj-rows": rows,
              } as CSSProperties
            }
          >
            {tiles.map((tile, i) => {
              if (tile.removed && !matchingIds.has(tile.id)) return null;
              const free = freeIds.has(tile.id);
              const selected = selectedId === tile.id;
              const wrong = wrongIds.has(tile.id);
              const matching = matchingIds.has(tile.id);
              const partner = partnerIds.has(tile.id);
              const zIndex =
                (free ? 800 : 0) +
                (partner ? 40 : 0) +
                tile.z * 40 +
                Math.floor(tile.y * 6) +
                Math.floor(tile.x) +
                1;

              return (
                <button
                  key={tile.id}
                  type="button"
                  className={[
                    "mj-tile",
                    "is-deal",
                    free ? "is-free" : "is-blocked",
                    selected ? "is-selected" : "",
                    wrong ? "is-wrong" : "",
                    matching ? "is-matching" : "",
                    partner ? "is-partner" : "",
                    faceClass(tile.face),
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={
                    {
                      "--mj-x": tile.x - layout.bounds.minX,
                      "--mj-y": tile.y - layout.bounds.minY,
                      "--mj-z": tile.z,
                      zIndex,
                      animationDelay: `${Math.min(i, 24) * 18}ms`,
                    } as CSSProperties
                  }
                  disabled={matching}
                  aria-disabled={!free}
                  aria-pressed={selected}
                  aria-label={`${free ? "Free" : "Blocked"} ${faceKind(tile.face)} ${tile.face === "audio" ? "audio" : tile.label}${showRefs ? ` ${tile.refLabel}` : ""}`}
                  onClick={() => onTileClick(tile)}
                >
                  <span className="mj-tile-body">
                    <span className="mj-tile-face">
                      <span className="mj-tile-flourish" aria-hidden="true" />
                      <span className="mj-tile-seal" aria-hidden="true" />
                      {showRefs ? (
                        <span className="mj-ref">{tile.refLabel}</span>
                      ) : null}
                      {tile.face === "audio" ? (
                        <span className="mj-face-audio">
                          <span className="mj-play" aria-hidden="true">
                            ▶
                          </span>
                          {showRefs ? (
                            <span className="mj-audio-ref">{tile.refLabel}</span>
                          ) : (
                            <span className="mj-audio-hint">Tap</span>
                          )}
                        </span>
                      ) : tile.face === "word" ? (
                        <span className="mj-face-word">{tile.label}</span>
                      ) : (
                        <span className="mj-face-zh">{tile.label}</span>
                      )}
                      <span className="mj-kind">{faceKind(tile.face)}</span>
                    </span>
                  </span>
                </button>
              );
            })}

            {bursts.map((burst) => (
              <div
                key={burst.key}
                className="mj-burst"
                style={
                  {
                    left: burst.x,
                    top: burst.y,
                  } as CSSProperties
                }
                aria-hidden="true"
              >
                {burst.particles.map((p) => (
                  <span
                    key={p.id}
                    className="mj-burst-dot"
                    style={
                      {
                        "--dx": `${p.dx}px`,
                        "--dy": `${p.dy}px`,
                        "--size": `${p.size}px`,
                        background: `hsl(${p.hue} 68% 52%)`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            ))}

            {scorePops.map((pop) => (
              <div
                key={pop.key}
                className="mj-score-pop"
                style={
                  {
                    left: pop.x,
                    top: pop.y,
                  } as CSSProperties
                }
                aria-hidden="true"
              >
                {pop.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {stuck || (freeIds.size === 0 && remainingPairs > 0 && !won) ? (
        <div className="mj-stuck" role="status">
          <p>
            {freeIds.size === 0 && remainingPairs > 0
              ? "No free tiles — Remix to reshuffle remaining words."
              : "No matching free pairs left on the board."}
          </p>
          <button type="button" className="mj-btn mj-btn-primary" onClick={remix}>
            Remix tiles
          </button>
        </div>
      ) : null}

      <p
        className={`mj-status ${feedback ? `is-${feedback.kind}` : ""}`}
        role="status"
        aria-live="polite"
      >
        {feedback?.text ??
          `Group ${batch} (${batchLabel(batch)}) · ${remainingPairs} pairs left`}
      </p>

      <p className="mj-howto">
        How to play: free tiles lift slightly and glow; locked tiles look grey
        and will say &quot;Tile locked&quot; if tapped. Select one free tile, then its
        matching pair (opposite face — e.g. ▶ Audio ↔ English)
        {showRefs ? " with the same Ref #" : ""}.{" "}
        {needsAudioPool(mode)
          ? showRefs
            ? "Audio tiles show ▶ and Ref only (not the spelling) — tap to hear."
            : "Audio tiles show ▶ only (not the spelling) — tap to hear."
          : null}{" "}
        Use <strong>Remix</strong> if you get stuck.
        {showRefs ? (
          <>
            {" "}
            Dev mode: report bad glosses with <strong>Ref</strong> (e.g.{" "}
            <code>#0021</code>).
          </>
        ) : null}
      </p>

      {won ? (
        <div className="mj-win">
          <h2>Table cleared</h2>
          <p>
            {moves} moves · group {batch} progress {batchProgress.done}/
            {batchProgress.total} mastered
            {batch === 1 && batch1Mastered ? " · Group 2 unlocked!" : ""}
          </p>
          <div className="mj-toolbar" style={{ justifyContent: "center" }}>
            <button
              type="button"
              className="mj-btn mj-btn-primary"
              onClick={() => deal(batch, mode)}
            >
              Deal again
            </button>
            {batch === 1 && batch1Mastered ? (
              <button
                type="button"
                className="mj-btn mj-btn-ghost is-active"
                onClick={() => selectBatch(2)}
              >
                Open group 2
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mj-links">
        <Link href="/english-for-mandarin-speakers" className="mj-link">
          ← Vocab quiz
        </Link>
        <Link href="/english-for-mandarin-speakers/studio" className="mj-link">
          Audio Studio
        </Link>
        <Link href="/english-for-mandarin-speakers/review" className="mj-link">
          Audio review
        </Link>
      </div>
    </div>
  );
}
