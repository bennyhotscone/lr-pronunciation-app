"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import "./mahjong-match.css";

type TileFace = "word" | "zh";

type Tile = {
  id: string;
  pairId: number;
  face: TileFace;
  label: string;
  refLabel: string;
};

type PairCount = 4 | 6 | 8;
type Feedback = { kind: "ok" | "bad"; text: string } | null;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function refOf(rank: number): string {
  return `#${String(rank).padStart(4, "0")}`;
}

function pickWords(pool: MandarinVocabWord[], count: number): MandarinVocabWord[] {
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

function buildTiles(words: MandarinVocabWord[]): Tile[] {
  const tiles: Tile[] = [];
  for (const w of words) {
    const refLabel = refOf(w.rank);
    tiles.push({
      id: `${w.rank}-word`,
      pairId: w.rank,
      face: "word",
      label: w.word,
      refLabel,
    });
    tiles.push({
      id: `${w.rank}-zh`,
      pairId: w.rank,
      face: "zh",
      label: w.zh,
      refLabel,
    });
  }
  return shuffle(tiles);
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
  const [pairCount, setPairCount] = useState<PairCount>(6);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(() => new Set());
  const [moves, setMoves] = useState(0);
  const [dealKey, setDealKey] = useState(0);
  const [wins, setWins] = useState(0);
  const [bestMovesByBatch, setBestMovesByBatch] = useState<Record<string, number>>(
    {},
  );
  const [masteredRanks, setMasteredRanks] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [won, setWon] = useState(false);

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

  const persist = useCallback(
    (next: Partial<{
      batch: number;
      pairCount: PairCount;
      wins: number;
      bestMovesByBatch: Record<string, number>;
      masteredRanks: number[];
    }>) => {
      saveMahjongProgress({
        batch: next.batch ?? batch,
        pairCount: next.pairCount ?? pairCount,
        wins: next.wins ?? wins,
        bestMovesByBatch: next.bestMovesByBatch ?? bestMovesByBatch,
        masteredRanks: next.masteredRanks ?? masteredRanks,
      });
    },
    [batch, pairCount, wins, bestMovesByBatch, masteredRanks],
  );

  const deal = useCallback(
    (nextBatch: number, nextPairs: PairCount) => {
      lockRef.current = false;
      const words = wordsInMahjongBatch(nextBatch);
      setTiles(buildTiles(pickWords(words, nextPairs)));
      setFlipped([]);
      setMatched(new Set());
      setWrongIds(new Set());
      setMoves(0);
      setFeedback(null);
      setWon(false);
      setDealKey((k) => k + 1);
    },
    [],
  );

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
    setPairCount(saved.pairCount as PairCount);
    setWins(saved.wins);
    setBestMovesByBatch(saved.bestMovesByBatch);
    setMasteredRanks(saved.masteredRanks);
    deal(startBatch, saved.pairCount as PairCount);
    setHydrated(true);
  }, [deal]);

  const remaining = useMemo(
    () => tiles.filter((t) => !matched.has(t.pairId)).length / 2,
    [tiles, matched],
  );

  const onFlip = (tile: Tile) => {
    if (lockRef.current || won) return;
    if (matched.has(tile.pairId)) return;
    if (flipped.includes(tile.id)) return;
    if (flipped.length >= 2) return;

    const nextFlipped = [...flipped, tile.id];
    setFlipped(nextFlipped);
    setFeedback(null);

    if (nextFlipped.length < 2) return;

    const moveCount = moves + 1;
    setMoves(moveCount);
    const [aId, bId] = nextFlipped;
    const a = tiles.find((t) => t.id === aId);
    const b = tiles.find((t) => t.id === bId);
    if (!a || !b) return;

    if (a.pairId === b.pairId && a.face !== b.face) {
      lockRef.current = true;
      setFeedback({ kind: "ok", text: `Match · ${a.refLabel}` });
      window.setTimeout(() => {
        setMatched((prev) => {
          const nextMatched = new Set(prev);
          nextMatched.add(a.pairId);

          setMasteredRanks((cr) => {
            const nextMastered = cr.includes(a.pairId)
              ? cr
              : [...cr, a.pairId].sort((x, y) => x - y);

            if (nextMatched.size === Math.min(pairCount, pool.length)) {
              const key = String(batch);
              setWon(true);
              setWins((w) => {
                const nextWins = w + 1;
                setBestMovesByBatch((bm) => {
                  const prevBest = bm[key];
                  const nextBest =
                    prevBest == null
                      ? moveCount
                      : Math.min(prevBest, moveCount);
                  const nextBm = { ...bm, [key]: nextBest };
                  saveMahjongProgress({
                    batch,
                    pairCount,
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
                pairCount,
                wins,
                bestMovesByBatch,
                masteredRanks: nextMastered,
              });
            }
            return nextMastered;
          });

          return nextMatched;
        });
        setFlipped([]);
        lockRef.current = false;
      }, 420);
    } else {
      lockRef.current = true;
      setWrongIds(new Set([a.id, b.id]));
      setFeedback({
        kind: "bad",
        text: `Not a match · ${a.refLabel} / ${b.refLabel}`,
      });
      window.setTimeout(() => {
        setFlipped([]);
        setWrongIds(new Set());
        lockRef.current = false;
      }, 700);
    }
  };

  const selectBatch = (next: number) => {
    if (next === 2 && !batch1Mastered) return;
    setBatch(next);
    persist({ batch: next });
    deal(next, pairCount);
  };

  const changePairs = (next: PairCount) => {
    setPairCount(next);
    persist({ pairCount: next });
    deal(batch, next);
  };

  if (!hydrated) {
    return (
      <div className="mahjong-match">
        <p className="text-sm text-muted">Dealing the tiles…</p>
      </div>
    );
  }

  const best = bestMovesByBatch[String(batch)];

  return (
    <div className="mahjong-match">
      <section className="mj-hero" aria-labelledby="mj-title">
        <p className="mj-chip">Mahjong match · English ↔ 中文</p>
        <h1 id="mj-title" className="mj-title">
          Pair the tiles
        </h1>
        <p className="mj-lede">
          Match each English word with its Mandarin meaning. Frequency groups of{" "}
          {MAHJONG_BATCH_SIZE}: clear every word in group 1 to unlock group 2.
          Chinese glosses are curated for study (the INDEX PDF is lemmas only).
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
            {batch1Mastered ? "" : " 🔒"}
          </button>
        </div>

        <div className="mj-toolbar" role="group" aria-label="Board size">
          {([4, 6, 8] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`mj-btn mj-btn-ghost ${pairCount === n ? "is-active" : ""}`}
              onClick={() => changePairs(n)}
            >
              {n} pairs
            </button>
          ))}
          <button
            type="button"
            className="mj-btn mj-btn-primary"
            onClick={() => deal(batch, pairCount)}
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
        </div>
      </section>

      <div className="mj-table-wrap">
        <div className="mj-table" role="grid" aria-label="Mahjong matching board">
          <div
            className={`mj-grid ${pairCount === 8 ? "is-pairs-8" : ""}`}
            key={dealKey}
          >
            {tiles.map((tile, i) => {
              const isMatched = matched.has(tile.pairId);
              const isFlipped = isMatched || flipped.includes(tile.id);
              const isWrong = wrongIds.has(tile.id);
              return (
                <button
                  key={tile.id}
                  type="button"
                  role="gridcell"
                  className={[
                    "mj-tile",
                    "is-deal",
                    isFlipped ? "is-flipped" : "",
                    isMatched ? "is-matched" : "",
                    isWrong ? "is-wrong" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  disabled={isMatched}
                  aria-label={
                    isFlipped
                      ? `${tile.face} ${tile.label} ${tile.refLabel}`
                      : "Face-down tile"
                  }
                  aria-pressed={isFlipped}
                  onClick={() => onFlip(tile)}
                >
                  <span className="mj-tile-inner">
                    <span className="mj-face mj-face-back" aria-hidden="true">
                      <span className="mj-back-mark">🀄</span>
                    </span>
                    <span className="mj-face mj-face-front">
                      <span className="mj-ref">{tile.refLabel}</span>
                      {tile.face === "word" ? (
                        <span className="mj-face-word">{tile.label}</span>
                      ) : (
                        <span className="mj-face-zh">{tile.label}</span>
                      )}
                      <span className="mj-kind">
                        {tile.face === "word" ? "English" : "中文"}
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
          `Group ${batch} (${batchLabel(batch)}) · ${remaining} pairs left on the table`}
      </p>

      {won ? (
        <div className="mj-win">
          <h2>Table cleared</h2>
          <p>
            {moves} moves · group {batch} progress {batchProgress.done}/
            {batchProgress.total} mastered
            {batch === 1 && batch1Mastered
              ? " · Group 2 unlocked!"
              : ""}
          </p>
          <div className="mj-toolbar" style={{ justifyContent: "center" }}>
            <button
              type="button"
              className="mj-btn mj-btn-primary"
              onClick={() => deal(batch, pairCount)}
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
