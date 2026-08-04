"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ACTIVE_VOCAB_WORDS,
  audioUrl,
  type MandarinVocabWord,
} from "@/data/mandarin-vocab";
import {
  loadMahjongProgress,
  saveMahjongProgress,
  type MahjongMatchMode,
} from "@/lib/mahjong-progress";
import "./mahjong-match.css";

type TileFace = "audio" | "word" | "zh";

type Tile = {
  id: string;
  pairId: number;
  face: TileFace;
  label: string;
  audioFile?: string;
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

function pickWords(count: number): MandarinVocabWord[] {
  return shuffle(ACTIVE_VOCAB_WORDS).slice(0, count);
}

function buildTiles(words: MandarinVocabWord[], mode: MahjongMatchMode): Tile[] {
  const tiles: Tile[] = [];
  for (const w of words) {
    const refLabel = refOf(w.rank);
    if (mode === "audio-zh") {
      tiles.push({
        id: `${w.rank}-audio`,
        pairId: w.rank,
        face: "audio",
        label: "Listen",
        audioFile: w.audioFile,
        refLabel,
      });
      tiles.push({
        id: `${w.rank}-zh`,
        pairId: w.rank,
        face: "zh",
        label: w.zh,
        refLabel,
      });
    } else {
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
  }
  return shuffle(tiles);
}

export function MahjongMatch() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lockRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<MahjongMatchMode>("audio-zh");
  const [pairCount, setPairCount] = useState<PairCount>(6);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(() => new Set());
  const [moves, setMoves] = useState(0);
  const [dealKey, setDealKey] = useState(0);
  const [wins, setWins] = useState(0);
  const [bestMoves, setBestMoves] = useState<number | null>(null);
  const [clearedRanks, setClearedRanks] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [won, setWon] = useState(false);

  const persist = useCallback(
    (next: Partial<{
      mode: MahjongMatchMode;
      pairCount: PairCount;
      wins: number;
      bestMoves: number | null;
      clearedRanks: number[];
    }>) => {
      saveMahjongProgress({
        mode: next.mode ?? mode,
        pairCount: next.pairCount ?? pairCount,
        wins: next.wins ?? wins,
        bestMoves: next.bestMoves !== undefined ? next.bestMoves : bestMoves,
        clearedRanks: next.clearedRanks ?? clearedRanks,
      });
    },
    [mode, pairCount, wins, bestMoves, clearedRanks],
  );

  const deal = useCallback(
    (nextMode: MahjongMatchMode, nextPairs: PairCount) => {
      lockRef.current = false;
      setTiles(buildTiles(pickWords(nextPairs), nextMode));
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
    setMode(saved.mode);
    setPairCount(saved.pairCount as PairCount);
    setWins(saved.wins);
    setBestMoves(saved.bestMoves);
    setClearedRanks(saved.clearedRanks);
    deal(saved.mode, saved.pairCount as PairCount);
    setHydrated(true);
  }, [deal]);

  const playAudio = useCallback((file: string) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.pause();
    a.src = audioUrl(file);
    void a.play().catch(() => {});
  }, []);

  const remaining = useMemo(
    () => tiles.filter((t) => !matched.has(t.pairId)).length / 2,
    [tiles, matched],
  );

  const onFlip = (tile: Tile) => {
    if (lockRef.current || won) return;
    if (matched.has(tile.pairId)) return;
    if (flipped.includes(tile.id)) return;
    if (flipped.length >= 2) return;

    if (tile.face === "audio" && tile.audioFile) {
      playAudio(tile.audioFile);
    }

    const nextFlipped = [...flipped, tile.id];
    setFlipped(nextFlipped);
    setFeedback(null);

    if (nextFlipped.length < 2) return;

    setMoves((m) => m + 1);
    const [aId, bId] = nextFlipped;
    const a = tiles.find((t) => t.id === aId);
    const b = tiles.find((t) => t.id === bId);
    if (!a || !b) return;

    if (a.pairId === b.pairId && a.face !== b.face) {
      lockRef.current = true;
      setFeedback({ kind: "ok", text: `Match · ${a.refLabel}` });
      const moveCount = moves + 1;
      window.setTimeout(() => {
        setMatched((prev) => {
          const nextMatched = new Set(prev);
          nextMatched.add(a.pairId);
          const cleared = pairCount;
          if (nextMatched.size === cleared) {
            setWon(true);
            setWins((w) => {
              const nextWins = w + 1;
              setBestMoves((bBest) => {
                const nextBest =
                  bBest == null ? moveCount : Math.min(bBest, moveCount);
                setClearedRanks((cr) => {
                  const nextCleared = cr.includes(a.pairId)
                    ? cr
                    : [...cr, a.pairId].sort((x, y) => x - y);
                  saveMahjongProgress({
                    mode,
                    pairCount,
                    wins: nextWins,
                    bestMoves: nextBest,
                    clearedRanks: nextCleared,
                  });
                  return nextCleared;
                });
                return nextBest;
              });
              return nextWins;
            });
            setFeedback({ kind: "ok", text: "Board cleared!" });
          } else {
            setClearedRanks((cr) => {
              if (cr.includes(a.pairId)) return cr;
              const nextCleared = [...cr, a.pairId].sort((x, y) => x - y);
              saveMahjongProgress({
                mode,
                pairCount,
                wins,
                bestMoves,
                clearedRanks: nextCleared,
              });
              return nextCleared;
            });
          }
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

  const changeMode = (next: MahjongMatchMode) => {
    setMode(next);
    persist({ mode: next });
    deal(next, pairCount);
  };

  const changePairs = (next: PairCount) => {
    setPairCount(next);
    persist({ pairCount: next });
    deal(mode, next);
  };

  if (!hydrated) {
    return (
      <div className="mahjong-match">
        <p className="text-sm text-muted">Dealing the tiles…</p>
      </div>
    );
  }

  return (
    <div className="mahjong-match">
      <section className="mj-hero" aria-labelledby="mj-title">
        <p className="mj-chip">Mahjong match · vocab</p>
        <h1 id="mj-title" className="mj-title">
          Pair the tiles
        </h1>
        <p className="mj-lede">
          Classic board feel — flip two tiles, clear the table. Match English
          sound or spelling with Mandarin meaning. Ref numbers help you report
          a bad clip.
        </p>

        <div className="mj-toolbar" role="group" aria-label="Match type">
          <button
            type="button"
            className={`mj-btn mj-btn-ghost ${mode === "audio-zh" ? "is-active" : ""}`}
            onClick={() => changeMode("audio-zh")}
          >
            听音 ↔ 中文
          </button>
          <button
            type="button"
            className={`mj-btn mj-btn-ghost ${mode === "word-zh" ? "is-active" : ""}`}
            onClick={() => changeMode("word-zh")}
          >
            Word ↔ 中文
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
            onClick={() => deal(mode, pairCount)}
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
            <div className="mj-stat-val">{remaining}</div>
            <div className="mj-stat-label">Left</div>
          </div>
          <div className="mj-stat">
            <div className="mj-stat-val">{bestMoves ?? "—"}</div>
            <div className="mj-stat-label">Best</div>
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
                  disabled={isMatched || lockRef.current}
                  aria-label={
                    isFlipped
                      ? `${tile.face} ${tile.label} ${tile.refLabel}`
                      : `Face-down tile`
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
                      {tile.face === "audio" ? (
                        <span className="mj-face-audio">
                          <span className="mj-speaker" aria-hidden="true">
                            ♪
                          </span>
                          <span className="mj-listen-hint">Tap sound</span>
                        </span>
                      ) : tile.face === "word" ? (
                        <span className="mj-face-word">{tile.label}</span>
                      ) : (
                        <span className="mj-face-zh">{tile.label}</span>
                      )}
                      <span className="mj-kind">
                        {tile.face === "audio"
                          ? "Audio"
                          : tile.face === "word"
                            ? "English"
                            : "中文"}
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
          (mode === "audio-zh"
            ? "Flip a sound tile and its Mandarin meaning."
            : "Flip an English word and its Mandarin meaning.")}
      </p>

      {won ? (
        <div className="mj-win">
          <h2>Table cleared</h2>
          <p>
            {moves} moves · {wins} win{wins === 1 ? "" : "s"} saved on this
            device
            {bestMoves != null ? ` · best ${bestMoves}` : ""}
          </p>
          <div className="mj-toolbar" style={{ justifyContent: "center" }}>
            <button
              type="button"
              className="mj-btn mj-btn-primary"
              onClick={() => deal(mode, pairCount)}
            >
              Deal again
            </button>
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
