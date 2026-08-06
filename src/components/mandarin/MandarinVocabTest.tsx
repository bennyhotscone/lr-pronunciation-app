"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACTIVE_VOCAB_WORDS,
  MODE_BASE_POINTS,
  MODE_LABELS,
  type DifficultyMode,
  type MandarinVocabWord,
} from "@/data/mandarin-vocab";
import { useAudioOverrides } from "@/lib/audio-overrides-client";
import {
  loadMandarinProgress,
  saveMandarinProgress,
} from "@/lib/mandarin-progress";
import "./mandarin-test.css";

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

type Feedback = { kind: "ok" | "bad"; text: string } | null;

export function MandarinVocabTest() {
  const words = ACTIVE_VOCAB_WORDS;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { resolveUrl } = useAudioOverrides();
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<DifficultyMode>("mandarin");
  const [idx, setIdx] = useState(0);
  const [points, setPoints] = useState(0);
  const [mastered, setMastered] = useState<number[]>([]);
  const [unlockedGroup, setUnlockedGroup] = useState(1);
  const [listens, setListens] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [pickedWrong, setPickedWrong] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [narrow, setNarrow] = useState(false);

  const masteredSet = useMemo(() => new Set(mastered), [mastered]);
  const current: MandarinVocabWord | undefined = words[idx];

  const persist = useCallback(
    (next: {
      mode?: DifficultyMode;
      idx?: number;
      points?: number;
      mastered?: number[];
      unlockedGroup?: number;
    }) => {
      const payload = {
        mode: next.mode ?? mode,
        idx: next.idx ?? idx,
        points: next.points ?? points,
        mastered: next.mastered ?? mastered,
        unlockedGroup: next.unlockedGroup ?? unlockedGroup,
      };
      saveMandarinProgress(payload);
    },
    [mode, idx, points, mastered, unlockedGroup],
  );

  useEffect(() => {
    const saved = loadMandarinProgress();
    setMode(saved.mode);
    setIdx(
      saved.idx >= 0 && saved.idx < words.length ? saved.idx : 0,
    );
    setPoints(saved.points);
    setMastered(saved.mastered);
    setUnlockedGroup(saved.unlockedGroup ?? 1);
    setHydrated(true);
  }, [words.length]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const basePoints = MODE_BASE_POINTS[mode];
  const possiblePoints = Math.max(
    1,
    basePoints - Math.max(0, listens - 1) - (revealed && mode !== "easy" ? 2 : 0),
  );

  const buildOptions = useCallback(
    (wordIndex: number, nextMode: DifficultyMode) => {
      const key = nextMode === "english" ? "en" : "zh";
      const correct = words[wordIndex][key];
      const pool = shuffle(words.filter((_, i) => i !== wordIndex))
        .slice(0, 5)
        .map((x) => x[key]);
      return shuffle([correct, ...pool]);
    },
    [words],
  );

  const startRound = useCallback(
    (wordIndex: number, nextMode: DifficultyMode, autoPlayEasy: boolean) => {
      setAnswered(false);
      setListens(0);
      setRevealed(nextMode === "easy");
      setFeedback(null);
      setPickedWrong(null);
      setOptions(buildOptions(wordIndex, nextMode));
      if (autoPlayEasy && nextMode === "easy") {
        // play after state settles
        queueMicrotask(() => {
          const w = words[wordIndex];
          if (!w) return;
          const el = audioRef.current ?? new Audio();
          audioRef.current = el;
          el.src = resolveUrl(w.rank, w.audioFile);
          el.currentTime = 0;
          void el.play().catch(() => {});
          setListens(1);
        });
      }
    },
    [buildOptions, words, resolveUrl],
  );

  useEffect(() => {
    if (!hydrated) return;
    startRound(idx, mode, true);
    // only on hydrate / intentional mode+idx changes via handlers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const play = () => {
    if (!current) return;
    const el = audioRef.current ?? new Audio();
    audioRef.current = el;
    el.src = resolveUrl(current.rank, current.audioFile);
    el.currentTime = 0;
    void el.play().catch(() => {});
    setListens((n) => {
      const next = n + 1;
      return next;
    });
  };

  const onModeChange = (next: DifficultyMode) => {
    setMode(next);
    persist({ mode: next });
    startRound(idx, next, true);
  };

  const onReveal = () => {
    setRevealed(true);
  };

  const onAnswer = (text: string) => {
    if (answered || !current) return;
    const key = mode === "english" ? "en" : "zh";
    const correctText = current[key];
    const correct = text === correctText;
    setAnswered(true);
    setRevealed(true);

    if (correct) {
      const p = Math.max(
        1,
        basePoints -
          Math.max(0, listens - 1) -
          (revealed && mode !== "easy" ? 2 : 0),
      );
      const nextPoints = points + p;
      const nextMastered = masteredSet.has(current.rank)
        ? mastered
        : [...mastered, current.rank];
      setPoints(nextPoints);
      setMastered(nextMastered);
        setFeedback({
          kind: "ok",
          text: `Correct (#${String(current.rank).padStart(4, "0")}): ${current.word} — +${p} points`,
        });
        persist({ points: nextPoints, mastered: nextMastered });
      } else {
        setPickedWrong(text);
        setFeedback({
          kind: "bad",
          text: `Incorrect (#${String(current.rank).padStart(4, "0")}). The word was “${current.word}”.`,
        });
      }
  };

  const onNext = () => {
    const nextIdx = (idx + 1) % words.length;
    setIdx(nextIdx);
    persist({ idx: nextIdx });
    startRound(nextIdx, mode, true);
  };

  if (!hydrated || !current) {
    return <p className="text-sm text-muted">Loading vocabulary test…</p>;
  }

  const pct = Math.round((masteredSet.size / words.length) * 100);
  const mercuryStyle = narrow
    ? { width: `${pct}%`, height: "100%" }
    : { height: `${pct}%` };
  const correctKey = mode === "english" ? "en" : "zh";
  const correctAnswer = current[correctKey];
  const showWord = revealed || answered;

  return (
    <div className="mandarin-vocab-test">
      <div className="mb-4">
        <p className="chip bg-amber/25 text-foreground">中文母语者 · Group 1</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          English for Mandarin Speakers
        </h1>
        <p className="mt-1 text-sm text-muted">中文母语者英语课程</p>
      </div>

      <div className="mv-layout">
        <div className="mv-card">
          <div className="mv-topline">
            <div>
              Word {idx + 1} of {words.length}
            </div>
            <div>
              Points: <strong>{points}</strong>
            </div>
          </div>

          <div
            className="mv-ref"
            aria-label={`Reference number ${String(current.rank).padStart(4, "0")}`}
          >
            <span className="mv-ref-label">Ref</span>
            <span className="mv-ref-num">
              #{String(current.rank).padStart(4, "0")}
            </span>
            <span className="mv-ref-hint">
              Tell your teacher this number if something is wrong
            </span>
          </div>

          <div className="mv-modes">
            {(Object.keys(MODE_LABELS) as DifficultyMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`mv-mode${mode === m ? " active" : ""}`}
                onClick={() => onModeChange(m)}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          <div className="mv-audioBox">
            <p className="mv-ref-inline">
              Audio ref <strong>#{String(current.rank).padStart(4, "0")}</strong>
            </p>
            <button
              type="button"
              className="mv-play"
              aria-label={`Play word reference ${String(current.rank).padStart(4, "0")}`}
              onClick={play}
            >
              ▶
            </button>
            <div className="mv-listenCount">Listens: {listens} / 3</div>
          </div>

          {mode !== "easy" ? (
            <button type="button" className="mv-reveal" onClick={onReveal}>
              Show English word (fewer points)
            </button>
          ) : null}

          <div className="mv-word">{showWord ? current.word : ""}</div>

          <div className="mv-options">
            {options.map((text) => {
              let cls = "mv-opt";
              if (answered) {
                if (text === correctAnswer) cls += " correct";
                else if (text === pickedWrong) cls += " wrong";
              }
              return (
                <button
                  key={text}
                  type="button"
                  className={cls}
                  disabled={answered}
                  onClick={() => onAnswer(text)}
                >
                  {text}
                </button>
              );
            })}
          </div>

          <div
            className={`mv-feedback${feedback ? ` ${feedback.kind}` : ""}`}
          >
            {feedback?.text ?? ""}
          </div>

          <div className="mv-footerrow">
            <span>
              {answered
                ? "Continue when ready."
                : listens === 0
                  ? `Up to ${basePoints} points.`
                  : `Worth ${possiblePoints} points now.`}
            </span>
            <button
              type="button"
              className="mv-next"
              disabled={!answered}
              onClick={onNext}
            >
              Next
            </button>
          </div>

          <div className="mv-bar">
            <div
              className="mv-fill"
              style={{ width: `${(idx / words.length) * 100}%` }}
            />
          </div>

          <p className="mv-note">
            Built for 50 groups of 100 words (5,000 total). This quiz currently
            uses only the first clips that have vocabulary + audio wired in —
            bulk files past that are <strong>draft</strong> until verified in
            Audio Studio. Do not treat all manifest clips as approved.
          </p>
        </div>

        <aside className="mv-progressSide">
          <div className="mv-thermo">
            <div className="mv-mercury" style={mercuryStyle} />
          </div>
          <div className="mv-bulb" aria-hidden="true" />
          <div>
            <div className="mv-progressLabel">{pct}% mastered</div>
            <div className="mv-progressSub">
              {masteredSet.size} of {words.length} words answered correctly
            </div>
            <div className="mv-saveNote">
              Progress saves automatically in this browser.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
