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
  type MandarinVocabWord,
} from "@/data/mandarin-vocab";
import {
  loadMahjongProgress,
  saveMahjongProgress,
} from "@/lib/mahjong-progress";
import {
  TEMPLE_LAYOUT,
  LAYOUT_PAIR_COUNT,
  LAYOUT_BOUNDS,
  canMatch,
  isFree,
  shuffleSlots,
  type SolitaireTile,
} from "@/lib/mahjong-solitaire";
import "./mahjong-match.css";

type Feedback = { kind: "ok" | "bad" | "hint"; text: string } | null;

function refOf(rank: number): string {
  return `#${String(rank).padStart(4, "0")}`;
}

function pickWords(pool: MandarinVocabWord[], count: number): MandarinVocabWord[] {
  return shuffleSlots(pool).slice(0, Math.min(count, pool.length));
}

function buildDeal(words: MandarinVocabWord[]): SolitaireTile[] {
  const faces: Omit<SolitaireTile, "x" | "y" | "z" | "removed">[] = [];
  for (const w of words) {
    const refLabel = refOf(w.rank);
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
  const shuffled = shuffleSlots(faces);
  const slots = shuffleSlots([...TEMPLE_LAYOUT]);
  return shuffled.map((face, i) => {
    const slot = slots[i]!;
    return {
      ...face,
      x: slot.x,
      y: slot.y,
      z: slot.z,
      removed: false,
    };
  });
}

function batchLabel(batch: number): string {
  const start = (batch - 1) * MAHJONG_BATCH_SIZE + 1;
  const end = batch * MAHJONG_BATCH_SIZE;
  return `${start}–${end}`;
}

export function MahjongMatch() {
  const lockRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [batch, setBatch] = useState(1);
  const [tiles, setTiles] = useState<SolitaireTile[]>([]);
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
  const [won, setWon] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);

  const pool = useMemo(() => wordsInMahjongBatch(batch), [batch]);
  const masteredSet = useMemo(() => new Set(masteredRanks), [masteredRanks]);

  const batch1Mastered = useMemo(() => {
    const g1 = wordsInMahjongBatch(1);
    return g1.length > 0 && g1.every((w) => masteredSet.has(w.rank));
  }, [masteredSet]);

  const batchProgress = useMemo(() => {
    const done = pool.filter((w) => masteredSet.has(w.rank)).length;
    return { done, total: pool.length };
  }, [pool, masteredSet]);

  const freeIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of tiles) {
      if (isFree(t, tiles)) set.add(t.id);
    }
    return set;
  }, [tiles]);

  const remaining = useMemo(
    () => tiles.filter((t) => !t.removed).length / 2,
    [tiles],
  );

  const deal = useCallback((nextBatch: number) => {
    lockRef.current = false;
    const words = wordsInMahjongBatch(nextBatch);
    setTiles(buildDeal(pickWords(words, LAYOUT_PAIR_COUNT)));
    setSelectedId(null);
    setSelectedRef(null);
    setWrongIds(new Set());
    setMatchingIds(new Set());
    setMoves(0);
    setFeedback({
      kind: "hint",
      text: "Click a free tile, then its English ↔ 中文 pair.",
    });
    setWon(false);
    setDealKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const saved = loadMahjongProgress();
    const startBatch =
      saved.batch === 2 &&
      wordsInMahjongBatch(1).every((w) => saved.masteredRanks.includes(w.rank))
        ? 2
        : saved.batch === 2
          ? 1
          : saved.batch;
    setBatch(startBatch);
    setWins(saved.wins);
    setBestMovesByBatch(saved.bestMovesByBatch);
    setMasteredRanks(saved.masteredRanks);
    deal(startBatch);
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

  const onTileClick = (tile: SolitaireTile) => {
    if (lockRef.current || won || tile.removed) return;
    if (!freeIds.has(tile.id)) {
      setFeedback({
        kind: "bad",
        text: "Blocked — only free tiles (open left or right, nothing on top).",
      });
      return;
    }

    if (!selectedId) {
      setSelectedId(tile.id);
      setSelectedRef(tile.refLabel);
      setFeedback({
        kind: "hint",
        text: `Selected ${tile.refLabel} · find the ${tile.face === "word" ? "中文" : "English"} match`,
      });
      return;
    }

    if (selectedId === tile.id) {
      setSelectedId(null);
      setSelectedRef(null);
      setFeedback({ kind: "hint", text: "Selection cleared." });
      return;
    }

    const a = tiles.find((t) => t.id === selectedId);
    const b = tile;
    if (!a || a.removed) {
      setSelectedId(tile.id);
      setSelectedRef(tile.refLabel);
      return;
    }

    const moveCount = moves + 1;
    setMoves(moveCount);

    if (canMatch(a, b)) {
      lockRef.current = true;
      setMatchingIds(new Set([a.id, b.id]));
      setFeedback({ kind: "ok", text: `Match · ${a.refLabel}` });
      setSelectedId(null);
      setSelectedRef(null);

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
              setFeedback({ kind: "ok", text: "Board cleared!" });
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
      }, 480);
    } else {
      lockRef.current = true;
      setWrongIds(new Set([a.id, b.id]));
      setFeedback({
        kind: "bad",
        text: `Not a pair · ${a.refLabel} / ${b.refLabel}`,
      });
      window.setTimeout(() => {
        setWrongIds(new Set());
        setSelectedId(b.id);
        setSelectedRef(b.refLabel);
        lockRef.current = false;
      }, 520);
    }
  };

  const selectBatch = (next: number) => {
    if (next === 2 && !batch1Mastered) return;
    setBatch(next);
    persist({ batch: next });
    deal(next);
  };

  if (!hydrated) {
    return (
      <div className="mahjong-match">
        <p className="mj-loading">Dealing the tiles…</p>
      </div>
    );
  }

  const best = bestMovesByBatch[String(batch)];
  const cols = LAYOUT_BOUNDS.maxX - LAYOUT_BOUNDS.minX + 1;
  const rows = LAYOUT_BOUNDS.maxY - LAYOUT_BOUNDS.minY + 1;

  return (
    <div className="mahjong-match">
      <section className="mj-hero" aria-labelledby="mj-title">
        <p className="mj-chip">Mahjong Solitaire · English ↔ 中文</p>
        <h1 id="mj-title" className="mj-title">
          Clear the table
        </h1>
        <p className="mj-lede">
          Stacked tiles — only free ones (nothing on top, open on left or right)
          can be selected. Match English with its Mandarin gloss. Master all{" "}
          {MAHJONG_BATCH_SIZE} words in group 1 to unlock group 2.
        </p>

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
            className="mj-btn mj-btn-primary"
            onClick={() => deal(batch)}
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
          <div className="mj-stat mj-stat-ref" aria-live="polite">
            <div className="mj-stat-val mj-stat-ref-val">
              {selectedRef ?? "—"}
            </div>
            <div className="mj-stat-label">Ref</div>
          </div>
        </div>
      </section>

      <div className="mj-table-wrap">
        <div className="mj-table" aria-label="Mahjong solitaire board">
          <div
            className="mj-board"
            key={dealKey}
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
              const zIndex =
                tile.z * 40 + Math.floor(tile.y * 6) + Math.floor(tile.x) + 1;

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
                    tile.face === "zh" ? "is-zh" : "is-en",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={
                    {
                      "--mj-x": tile.x - LAYOUT_BOUNDS.minX,
                      "--mj-y": tile.y - LAYOUT_BOUNDS.minY,
                      "--mj-z": tile.z,
                      zIndex,
                      animationDelay: `${Math.min(i, 20) * 22}ms`,
                    } as CSSProperties
                  }
                  disabled={matching}
                  aria-disabled={!free}
                  aria-pressed={selected}
                  aria-label={`${free ? "Free" : "Blocked"} ${tile.face === "word" ? "English" : "Chinese"} ${tile.label} ${tile.refLabel}`}
                  onClick={() => onTileClick(tile)}
                >
                  <span className="mj-tile-body">
                    <span className="mj-tile-face">
                      <span className="mj-ref">{tile.refLabel}</span>
                      {tile.face === "word" ? (
                        <span className="mj-face-word">{tile.label}</span>
                      ) : (
                        <span className="mj-face-zh">{tile.label}</span>
                      )}
                      <span className="mj-kind">
                        {tile.face === "word" ? "EN" : "中文"}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p
        className={`mj-status ${feedback ? `is-${feedback.kind}` : ""}`}
        role="status"
        aria-live="polite"
      >
        {feedback?.text ??
          `Group ${batch} (${batchLabel(batch)}) · ${remaining} pairs left · Ref on each tile`}
      </p>

      <p className="mj-howto">
        How to play: free tiles lift slightly and glow. Select one, then its
        pair. Use <strong>Ref</strong> (e.g. <code>#0021</code>) when reporting
        a bad gloss.
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
              onClick={() => deal(batch)}
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
        <Link href="/english-for-mandarin-speakers/review" className="mj-link">
          Audio review
        </Link>
      </div>
    </div>
  );
}
