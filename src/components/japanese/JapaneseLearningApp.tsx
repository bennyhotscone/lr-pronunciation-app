"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  advanceAfterRound1Correct,
  advanceFormalQuestion,
  buildRoundView,
  computeSessionRoundScorePct,
  getActiveRound,
  getHighestRoundReached,
  jumpToRound,
  recordCorrect,
  recordCorrectWithStreak,
  recordMiss,
  repairSessionState,
  resolveWord,
  retryRound,
  ROUND_SHORT_LABELS,
  startFormalRound,
  transitionRound1ToRound2,
} from "@/lib/japanese/engine";
import {
  getJapaneseBlock,
  getPlayableBlockNumbers,
  isPlayableJapaneseBlock,
} from "@/lib/japanese/blocks";
import { getBlockCurriculumLabel } from "@/lib/japanese/blocks/frequency";
import {
  JAPANESE_ALWAYS_UNLOCKED_BLOCKS,
  JAPANESE_MASTERY_THRESHOLD,
  JAPANESE_TOTAL_BLOCKS,
  JAPANESE_WORDS_PER_BLOCK,
} from "@/lib/japanese/config";
import {
  getMilestoneForBlock,
} from "@/lib/japanese/milestone";
import { getRevisionGateForCompletedBlock, revisionGateLabel } from "@/lib/japanese/revision-gate";
import { fuzzyMatchEnglish, fuzzyMatchRomaji } from "@/lib/japanese/matching";
import { cancelJapaneseSpeech, playWordAudio } from "@/lib/japanese/tts";
import { buildPlayAudioDebug } from "@/lib/japanese/word-helpers";
import type {
  JapaneseBlockMeta,
  JapaneseRoundView,
  JapaneseSessionState,
} from "@/lib/japanese/types";
import {
  loadJapaneseProgress,
  completeJapaneseRound,
  recordJapaneseWordResult,
  resetJapaneseBlockProgress,
  saveJapaneseProgress,
  type JapaneseProgressPayload,
  type JapaneseWordStatSnapshot,
} from "@/lib/japanese-actions";
import { JapaneseMnemonicHook } from "./JapaneseMnemonicHook";
import { JapaneseMilestoneGate } from "./JapaneseMilestoneGate";
import { JapaneseRevisionGate } from "./JapaneseRevisionGate";
import { JapaneseWordList } from "./JapaneseWordList";
import { JapaneseWordNuance } from "./JapaneseWordNuance";
import {
  playCorrectAnswerSound,
  playIncorrectAnswerSound,
} from "@/lib/correct-answer-sound";
import { wordHasNuanceExplanation } from "@/lib/japanese/word-nuances";
import { getKnownIndices, statsToKnownWordsMap } from "@/lib/japanese/known-words";
import "./japanese-learning.css";

type Screen = "train" | "list" | "gate" | "revision";

function getTrainingRound(view: Exclude<JapaneseRoundView, { kind: "round-complete" }>): number {
  return view.kind === "formal" ? view.round : 1;
}

function isJapaneseBlockUnlocked(
  meta: JapaneseBlockMeta,
  currentBlock: number,
  targetBlock: number,
): boolean {
  if (targetBlock <= JAPANESE_ALWAYS_UNLOCKED_BLOCKS) return true;
  if (meta.unlockedBlocks.includes(targetBlock)) return true;
  // Mastering block N immediately unlocks block N+1 (matches round-complete UI).
  return (
    targetBlock === currentBlock + 1 &&
    currentBlock < JAPANESE_TOTAL_BLOCKS &&
    meta.blockMastered
  );
}

export function JapaneseLearningApp() {
  const [block, setBlock] = useState(1);
  const words = useMemo(() => getJapaneseBlock(block), [block]);
  const [screen, setScreen] = useState<Screen>("train");
  const [session, setSession] = useState<JapaneseSessionState | null>(null);
  const [meta, setMeta] = useState<JapaneseBlockMeta | null>(null);
  const [gatesPassed, setGatesPassed] = useState<number[]>([]);
  const [revisionGatesPassed, setRevisionGatesPassed] = useState<number[]>([]);
  const [activeGate, setActiveGate] = useState<number | null>(null);
  const [activeRevisionGate, setActiveRevisionGate] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<JapaneseProgressPayload["overrides"]>({});
  const [wordStats, setWordStats] = useState<Record<number, JapaneseWordStatSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [status, setStatus] = useState("");
  const [showReveal, setShowReveal] = useState(false);
  /** True when the learner missed the current word (shows mnemonic editor in feedback). */
  const [wasWrong, setWasWrong] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [choiceStates, setChoiceStates] = useState<Record<number, "correct" | "wrong" | null>>({});
  const [pending, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isPlayableJapaneseBlock(block)) {
      setLoading(false);
      setLoadError("This block is not available yet.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    loadJapaneseProgress(block)
      .then((data) => {
        if (cancelled) return;
        if ("error" in data) {
          setLoadError(data.error);
          setLoading(false);
          return;
        }
        const blockKnownIndices = [
          ...getKnownIndices(statsToKnownWordsMap(data.stats)),
        ];
        const repaired = repairSessionState(
          data.session,
          getJapaneseBlock(block).length,
          blockKnownIndices,
        );
        setSession(repaired);
        setMeta(data.meta);
        setGatesPassed(data.gatesPassed);
        setRevisionGatesPassed(data.revisionGatesPassed);
        setOverrides(data.overrides);
        setWordStats(data.stats);
        setLoading(false);
        if (
          repaired.phase !== data.session.phase ||
          repaired.order.length !== data.session.order.length
        ) {
          void saveJapaneseProgress(block, repaired, data.meta);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[JapaneseLearningApp] loadJapaneseProgress failed", err);
        setLoadError("Couldn't load progress. Please try again.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [block, loadAttempt]);

  const masterySyncRef = useRef(false);
  useEffect(() => {
    masterySyncRef.current = false;
  }, [block]);

  const knownWordsMap = useMemo(() => statsToKnownWordsMap(wordStats), [wordStats]);
  const knownIndices = useMemo(() => [...getKnownIndices(knownWordsMap)], [knownWordsMap]);

  const applyWordStat = useCallback((wordIndex: number, stat: JapaneseWordStatSnapshot) => {
    setWordStats((prev) => ({ ...prev, [wordIndex]: stat }));
  }, []);

  const recordWordResult = useCallback(
    (wordIndex: number, correct: boolean, round: 1 | 2 | 3 | 4 | 5) => {
      void recordJapaneseWordResult(block, wordIndex, correct, round).then((result) => {
        if ("ok" in result && result.ok) applyWordStat(wordIndex, result.stat);
      });
    },
    [block, applyWordStat],
  );

  const playableBlocks = useMemo(() => getPlayableBlockNumbers(), []);

  const openMilestoneGate = (milestoneNumber: number) => {
    setActiveGate(milestoneNumber);
    setScreen("gate");
  };

  const openRevisionGate = (gateNumber: number) => {
    setActiveRevisionGate(gateNumber);
    setScreen("revision");
  };

  const switchBlock = (next: number) => {
    if (!meta) return;
    if (!isJapaneseBlockUnlocked(meta, block, next) || !isPlayableJapaneseBlock(next)) return;
    setBlock(next);
    setScreen("train");
    resetQuestionUi();
  };

  const persist = useCallback(
    (nextSession: JapaneseSessionState, nextMeta: JapaneseBlockMeta) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveJapaneseProgress(block, nextSession, nextMeta);
      }, 400);
    },
    [block],
  );

  const highestRoundReached = useMemo(() => {
    if (!session || !meta) return 1 as const;
    return getHighestRoundReached(session, meta, words.length);
  }, [session, meta, words.length]);

  const activeRound = useMemo(() => {
    if (!session) return 1 as const;
    return getActiveRound(session, words.length);
  }, [session, words.length]);

  const view = useMemo(() => {
    if (!session) return null;
    return buildRoundView(session, words, overrides, knownWordsMap);
  }, [session, words, overrides, knownWordsMap]);

  useEffect(() => {
    if (!session || !meta || !view || view.kind !== "round-complete") return;
    if (view.round !== 5 || !view.passed) return;
    const nextBlock = block + 1;
    if (meta.blockMastered && isJapaneseBlockUnlocked(meta, block, nextBlock)) return;
    if (masterySyncRef.current) return;
    masterySyncRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    startTransition(async () => {
      const result = await completeJapaneseRound(block, session, meta, 5, view.scorePct);
      if ("ok" in result && result.ok) setMeta(result.meta);
      const fresh = await loadJapaneseProgress(block);
      if (!("error" in fresh)) {
        setMeta(fresh.meta);
        setRevisionGatesPassed(fresh.revisionGatesPassed);
      }
    });
  }, [session, meta, view, block]);

  const playbackRef = useRef({ words, overrides, view });
  playbackRef.current = { words, overrides, view };

  const currentWord = useMemo(() => {
    if (!view || view.kind === "round-complete") return null;
    const idx = view.wordIndex;
    return resolveWord(words[idx], idx, overrides[idx]);
  }, [view, words, overrides]);

  const playWordAudioAtIndex = useCallback((wordIndex: number) => {
    const { words: w, overrides: o } = playbackRef.current;
    const word = w[wordIndex];
    if (!word) return;
    const resolved = resolveWord(word, wordIndex, o[wordIndex]);
    const debug = buildPlayAudioDebug(word, wordIndex, o[wordIndex]);
    playWordAudio(resolved.speakText, debug);
  }, []);

  const playCurrentWordAudio = useCallback(() => {
    const v = playbackRef.current.view;
    if (!v || v.kind === "round-complete") return;
    playWordAudioAtIndex(v.wordIndex);
  }, [playWordAudioAtIndex]);

  const activeWordKey =
    view && view.kind !== "round-complete"
      ? `${view.kind}-${view.wordIndex}-${session?.phase ?? ""}-${session?.qIndex ?? ""}-${session?.introIndex ?? ""}-${session?.miniIndex ?? ""}`
      : null;

  useEffect(() => {
    if (!activeWordKey || !view || view.kind === "round-complete") return;
    if (view.kind === "formal" && view.mode === "type-romaji") return;

    const wordIndex = view.wordIndex;
    if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
    autoPlayTimer.current = setTimeout(() => {
      playWordAudioAtIndex(wordIndex);
    }, 300);

    return () => {
      if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
      cancelJapaneseSpeech();
    };
  }, [activeWordKey, view, playWordAudioAtIndex]);

  useEffect(() => {
    if (!view || view.kind === "round-complete") return;
    if (view.kind === "formal" && (view.mode === "type-english" || view.mode === "type-romaji")) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [view]);

  const resetQuestionUi = useCallback(() => {
    setAnswered(false);
    setStatus("");
    setShowReveal(false);
    setWasWrong(false);
    setTypedAnswer("");
    setChoiceStates({});
  }, []);

  const selectRound = useCallback(
    (round: 1 | 2 | 3 | 4 | 5) => {
      if (!session || !meta) return;
      if (round > highestRoundReached) return;
      const nextSession = jumpToRound(session, round, words.length, knownIndices);
      resetQuestionUi();
      setSession(nextSession);
      persist(nextSession, meta);
      setScreen("train");
    },
    [session, meta, words.length, highestRoundReached, resetQuestionUi, persist, knownIndices],
  );

  const handleMnemonicChange = useCallback((wordIndex: number, value: string | null) => {
    setOverrides((prev) => ({
      ...prev,
      [wordIndex]: { ...prev[wordIndex], mnemonic: value },
    }));
  }, []);

  const handleChoice = (choiceIndex: number) => {
    if (!session || !meta || !view || answered || view.kind === "round-complete") return;
    const correctIndex = view.wordIndex;
    const correct = choiceIndex === correctIndex;
    setAnswered(true);

    const nextChoices: Record<number, "correct" | "wrong" | null> = {
      ...choiceStates,
      [choiceIndex]: correct ? "correct" : "wrong",
    };
    if (!correct) nextChoices[correctIndex] = "correct";
    setChoiceStates(nextChoices);

    let nextSession = session;
    if (correct) {
      const round = getActiveRound(session, words.length);
      nextSession =
        round >= 4 ? recordCorrectWithStreak(session, correctIndex) : recordCorrect(session);
      setStatus("Correct");
      playCorrectAnswerSound();
    } else {
      nextSession = recordMiss(session, correctIndex);
      setStatus(`Answer: ${words[correctIndex].en}`);
      playIncorrectAnswerSound();
    }

    recordWordResult(correctIndex, correct, getActiveRound(session, words.length));
    setWasWrong(!correct);
    setShowReveal(true);
    setSession(nextSession);
    persist(nextSession, meta);
  };

  const handleCheckTyped = () => {
    if (!session || !meta || !view || answered || view.kind !== "formal") return;
    if (!typedAnswer.trim()) {
      setStatus("Type an answer first.");
      return;
    }

    setAnswered(true);
    const word = words[view.wordIndex];
    let correct = false;
    if (view.mode === "type-english") {
      correct = fuzzyMatchEnglish(typedAnswer, word);
    } else if (view.mode === "type-romaji") {
      correct = fuzzyMatchRomaji(typedAnswer, word);
    }

    let nextSession = session;
    if (correct) {
      nextSession =
        view.round >= 4
          ? recordCorrectWithStreak(session, view.wordIndex)
          : recordCorrect(session);
      setStatus("Accepted");
      playCorrectAnswerSound();
      if (view.mode === "type-romaji" && view.round === 5) {
        playWordAudioAtIndex(view.wordIndex);
      }
    } else {
      nextSession = recordMiss(session, view.wordIndex);
      setStatus(view.mode === "type-english" ? `Answer: ${word.en}` : `Answer: ${word.r}`);
      playIncorrectAnswerSound();
      playCurrentWordAudio();
    }

    recordWordResult(view.wordIndex, correct, view.round);
    setWasWrong(!correct);
    setShowReveal(true);
    setSession(nextSession);
    persist(nextSession, meta);
  };

  const handleRetryRound = () => {
    if (!session || !meta || !view || view.kind !== "round-complete") return;
    const nextSession = retryRound(session, words.length, knownIndices);
    resetQuestionUi();
    setSession(nextSession);
    persist(nextSession, meta);
  };

  const handleViewBlockResults = () => {
    resetQuestionUi();
    setScreen("list");
  };

  const handleContinue = () => {
    if (!session || !meta || !view) return;

    if (view.kind === "round-complete") {
      if (view.nextRound) {
        const nextSession =
          view.round === 1
            ? transitionRound1ToRound2(session, words.length, knownIndices)
            : startFormalRound(session, view.nextRound, words.length, {
                knownIndices,
              });
        resetQuestionUi();
        setSession(nextSession);
        persist(nextSession, meta);
      }
      return;
    }

    resetQuestionUi();

    if (session.phase === "round1") {
      const nextSession = advanceAfterRound1Correct(session, words.length);
      setSession(nextSession);
      persist(nextSession, meta);
      return;
    }

    const nextSession = advanceFormalQuestion(session);
    if (nextSession.qIndex >= nextSession.order.length) {
      const round = Number(session.phase.replace("round", "")) as 2 | 3 | 4 | 5;
      const scorePct = computeSessionRoundScorePct(session, words.length, knownIndices);
      setSession(nextSession);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      startTransition(async () => {
        const result = await completeJapaneseRound(block, nextSession, meta, round, scorePct);
        if ("ok" in result && result.ok) {
          setMeta(result.meta);
        }
        const fresh = await loadJapaneseProgress(block);
        if (!("error" in fresh)) {
          setMeta(fresh.meta);
          setWordStats(fresh.stats);
          setRevisionGatesPassed(fresh.revisionGatesPassed);
        }
      });
      return;
    }
    setSession(nextSession);
    persist(nextSession, meta);
  };

  const handleReset = () => {
    if (!confirm(`Reset Block ${block} progress? Your word customizations will stay.`)) return;
    startTransition(async () => {
      await resetJapaneseBlockProgress(block);
      const fresh = await loadJapaneseProgress(block);
      if ("error" in fresh) return;
      setSession(fresh.session);
      setMeta(fresh.meta);
      setGatesPassed(fresh.gatesPassed);
      setRevisionGatesPassed(fresh.revisionGatesPassed);
      setWordStats(fresh.stats);
      resetQuestionUi();
    });
  };

  const optionalGateMilestone = useMemo(() => {
    const milestone = getMilestoneForBlock(block);
    if (!milestone || !meta?.blockMastered) return null;
    if (gatesPassed.includes(milestone)) return null;
    return milestone;
  }, [block, meta?.blockMastered, gatesPassed]);

  const suggestedRevisionGate = useMemo(() => {
    const gate = getRevisionGateForCompletedBlock(block);
    if (!gate || !meta?.blockMastered) return null;
    if (revisionGatesPassed.includes(gate)) return null;
    return gate;
  }, [block, meta?.blockMastered, revisionGatesPassed]);

  const availableRevisionGates = useMemo(() => {
    const gates: number[] = [];
    if (isPlayableJapaneseBlock(5)) gates.push(1);
    if (isPlayableJapaneseBlock(10)) gates.push(2);
    return gates;
  }, []);

  if (screen === "revision" && activeRevisionGate) {
    return (
      <JapaneseRevisionGate
        gateNumber={activeRevisionGate}
        onPassed={(unlocksBlock) => {
          setRevisionGatesPassed((prev) =>
            prev.includes(activeRevisionGate)
              ? prev
              : [...prev, activeRevisionGate].sort((a, b) => a - b),
          );
          void loadJapaneseProgress(block).then((data) => {
            if ("error" in data) return;
            setMeta(data.meta);
            setRevisionGatesPassed(data.revisionGatesPassed);
          });
          if (isPlayableJapaneseBlock(unlocksBlock)) {
            setBlock(unlocksBlock);
            setScreen("train");
            setActiveRevisionGate(null);
          } else {
            setScreen("train");
            setActiveRevisionGate(null);
          }
        }}
        onClose={() => {
          setScreen("train");
          setActiveRevisionGate(null);
        }}
      />
    );
  }

  if (screen === "gate" && activeGate) {
    return (
      <JapaneseMilestoneGate
        milestoneNumber={activeGate}
        onPassed={(unlocksBlock) => {
          setGatesPassed((prev) =>
            prev.includes(activeGate) ? prev : [...prev, activeGate].sort((a, b) => a - b),
          );
          void loadJapaneseProgress(block).then((data) => {
            if ("error" in data) return;
            setMeta(data.meta);
            setGatesPassed(data.gatesPassed);
          });
          if (isPlayableJapaneseBlock(unlocksBlock)) {
            setBlock(unlocksBlock);
            setScreen("train");
            setActiveGate(null);
          } else {
            setScreen("train");
            setActiveGate(null);
          }
        }}
        onClose={() => {
          setScreen("train");
          setActiveGate(null);
        }}
      />
    );
  }

  if (loadError) {
    return (
      <div className="jp-learn-wrap">
        <p className="text-muted">{loadError}</p>
        <button
          type="button"
          className="jp-learn-btn jp-learn-btn-primary mt-3"
          onClick={() => setLoadAttempt((n) => n + 1)}
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading || !session || !meta) {
    return <p className="text-muted">Loading your Japanese progress.</p>;
  }

  const roundComplete = view?.kind === "round-complete";

  const practiceRoundNav = (
    <nav className="jp-learn-round-nav" aria-label="Training rounds">
      {([1, 2, 3, 4, 5] as const).map((r) => {
        const locked = r > highestRoundReached;
        const score =
          r === 1 ? undefined : meta.roundScores[String(r) as "2" | "3" | "4" | "5"];
        const pillActive = activeRound === r && screen === "train";
        return (
          <button
            key={r}
            type="button"
            className={`jp-learn-round-pill ${pillActive ? "jp-learn-round-pill-active" : ""} ${locked ? "jp-learn-round-pill-locked" : ""}`}
            disabled={locked || pending}
            onClick={() => selectRound(r)}
            title={ROUND_SHORT_LABELS[r]}
          >
            <span className="jp-learn-round-pill-num">Round {r}</span>
            <span className="jp-learn-round-pill-label">{ROUND_SHORT_LABELS[r]}</span>
            {score !== undefined ? (
              <span className="jp-learn-round-pill-score">{score}%</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="jp-learn-wrap">
      <header className="jp-learn-header">
        <div className="jp-learn-meta">{getBlockCurriculumLabel(block)} · Block {block} of {JAPANESE_TOTAL_BLOCKS} · {JAPANESE_WORDS_PER_BLOCK} words</div>
        <h1 className="jp-learn-title">Top 5,000 Spoken English Words</h1>
        {meta.bestRound5Score > 0 ? (
          <p className="jp-learn-meta mt-2">
            Best Round 5: {meta.bestRound5Score}%
            {meta.blockMastered ? " · Block mastered" : ""}
          </p>
        ) : null}
        {suggestedRevisionGate ? (
          <div className="jp-learn-gate-banner" role="status">
            <p>
              Recommended: revise {revisionGateLabel(suggestedRevisionGate)} while blocks{" "}
              {suggestedRevisionGate === 1 ? "1–5" : "6–10"} are fresh in memory.
            </p>
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-gate"
              onClick={() => openRevisionGate(suggestedRevisionGate)}
            >
              Start revision quiz (250 words)
            </button>
          </div>
        ) : null}
        {availableRevisionGates.length > 0 ? (
          <section className="jp-learn-practice" aria-labelledby="jp-revision-heading">
            <h2 id="jp-revision-heading" className="jp-learn-practice-title">Revision quizzes</h2>
            <p className="jp-learn-sub">All-words review for each 5-block segment (250 words, 80% to pass).</p>
            <div className="jp-learn-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              {availableRevisionGates.map((gate) => (
                <button
                  key={gate}
                  type="button"
                  className="jp-learn-btn jp-learn-btn-gate"
                  disabled={pending}
                  onClick={() => openRevisionGate(gate)}
                >
                  {revisionGateLabel(gate)}
                  {revisionGatesPassed.includes(gate) ? " ✓" : ""}
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {optionalGateMilestone ? (
          <div className="jp-learn-gate-banner" role="status">
            <p>
              Optional story practice for Blocks{" "}
              {optionalGateMilestone * 2 - 1}–{optionalGateMilestone * 2}.
            </p>
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-gate"
              onClick={() => openMilestoneGate(optionalGateMilestone)}
            >
              Take story checkpoint (optional)
            </button>
          </div>
        ) : null}
        <nav className="jp-learn-block-nav" aria-label="Japanese blocks">
          {playableBlocks.map((n) => {
            const unlocked = isJapaneseBlockUnlocked(meta, block, n);
            const active = n === block;
            return (
              <button
                key={n}
                type="button"
                className={active ? "jp-learn-btn jp-learn-btn-primary" : "jp-learn-btn"}
                disabled={!unlocked || pending}
                onClick={() => switchBlock(n)}
              >
                Block {n}
                {!unlocked ? " (locked)" : null}
              </button>
            );
          })}
        </nav>
        <section className="jp-learn-practice" aria-labelledby="jp-practice-heading">
          <h2 id="jp-practice-heading" className="jp-learn-practice-title">Practice</h2>
          <p className="jp-learn-sub">Block {block} — pick any round you have reached (1–5).</p>
          {practiceRoundNav}
        </section>
      </header>

      <nav className="jp-learn-nav" aria-label="Japanese learning sections">
        <button
          type="button"
          className={`jp-learn-btn ${screen === "train" ? "jp-learn-btn-primary" : ""}`}
          onClick={() => setScreen("train")}
        >
          Train
        </button>
        <button
          type="button"
          className={`jp-learn-btn ${screen === "list" ? "jp-learn-btn-primary" : ""}`}
          onClick={() => setScreen("list")}
        >
          Word list
        </button>
      </nav>

      {screen === "train" ? (
        <>
          <section className="jp-learn-card" aria-live="polite">
          {roundComplete ? (
            <>
              <div className="jp-learn-row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="jp-learn-meta">Round {view.round} complete</div>
                  <div className="jp-learn-meta">Score: {view.scorePct}%</div>
                </div>
              </div>
              <div className="jp-learn-progress">
                <div style={{ width: `${view.progressPct}%` }} />
              </div>
              <div className="jp-learn-big">
                {view.round < 5
                  ? view.passed
                    ? "Round passed"
                    : "Round complete"
                  : view.passed
                    ? `Block ${block} mastered`
                    : `Block ${block} complete`}
              </div>
              <p className="jp-learn-sub">
                {view.round < 5
                  ? view.passed
                    ? `Round target is ${JAPANESE_MASTERY_THRESHOLD}%. Retry Round ${view.round} or continue to Round ${view.nextRound}.`
                    : `Score below ${JAPANESE_MASTERY_THRESHOLD}%. Retry Round ${view.round} to practice again, or continue to Round ${view.nextRound}.`
                  : view.passed
                    ? `You completed the hardest production round at ${view.scorePct}%. Retry Round 5 anytime to sharpen recall.`
                    : `Final production score: ${view.scorePct}%. Retry Round 5 to practice again before moving on.`}
              </p>
              <div className="jp-learn-reveal">
                {view.missedIndices.length === 0 ? (
                  <strong>Perfect round.</strong>
                ) : (
                  <div>
                    <strong>Missed words</strong>
                    {view.missedIndices.slice(0, 20).map((idx) => (
                      <div key={idx} style={{ margin: "0.5rem 0" }}>
                        <b>{words[idx].r}</b> — {words[idx].en}
                      </div>
                    ))}
                    {view.missedIndices.length > 20 ? (
                      <div className="jp-learn-sub">+ {view.missedIndices.length - 20} more</div>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="jp-learn-row mt-3" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
                {view.retryRound ? (
                  <button
                    type="button"
                    className="jp-learn-btn jp-learn-btn-primary"
                    onClick={handleRetryRound}
                  >
                    Retry Round {view.retryRound}
                  </button>
                ) : null}
                {view.nextRound ? (
                  <button
                    type="button"
                    className="jp-learn-btn jp-learn-btn-primary"
                    onClick={handleContinue}
                  >
                    Continue to Round {view.nextRound}
                  </button>
                ) : view.round === 5 ? (
                  <>
                    {optionalGateMilestone ? (
                      <button
                        type="button"
                        className="jp-learn-btn"
                        onClick={() => openMilestoneGate(optionalGateMilestone)}
                      >
                        Story checkpoint (optional)
                      </button>
                    ) : null}
                    {highestRoundReached >= 4 ? (
                      <button
                        type="button"
                        className="jp-learn-btn"
                        onClick={() => selectRound(4)}
                        disabled={pending}
                      >
                        Practice Round 4
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="jp-learn-btn"
                      onClick={() => selectRound(5)}
                      disabled={pending}
                    >
                      Practice Round 5
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="jp-learn-btn"
                    onClick={handleViewBlockResults}
                  >
                    View Block Results
                  </button>
                )}
              </div>
            </>
          ) : view && currentWord ? (
            <>
              <div className="jp-learn-row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="jp-learn-meta">{view.roundLabel}</div>
                  <div className="jp-learn-meta">{view.counter}</div>
                </div>
                {"scoreLabel" in view ? (
                  <div className="jp-learn-meta">{view.scoreLabel}</div>
                ) : null}
              </div>
              <div className="jp-learn-progress">
                <div style={{ width: `${view.progressPct}%` }} />
              </div>

              {view.showMnemonic && view.kind !== "formal" && !(answered && wasWrong) ? (
                <JapaneseMnemonicHook
                  blockNumber={block}
                  wordIndex={currentWord.index}
                  canonicalMnemonic={words[currentWord.index].m}
                  mnemonic={overrides[currentWord.index]?.mnemonic}
                  showRomajiLine={
                    view.kind === "round1-new"
                      ? { romaji: currentWord.displayRomaji, english: currentWord.en }
                      : undefined
                  }
                  romajiMd={view.kind === "round1-mini" ? currentWord.displayRomaji : undefined}
                  onMnemonicChange={handleMnemonicChange}
                />
              ) : null}

              {view.kind === "formal" && view.showPronunciationCue && view.pronunciationCue ? (
                <div className="jp-learn-romaji-xl">{view.pronunciationCue}</div>
              ) : null}

              {view.kind === "formal" && view.mode === "type-romaji" ? (
                <div className="jp-learn-prompt-en">{currentWord.en}</div>
              ) : view.kind === "formal" && (view.mode === "type-english" || view.round === 3) ? (
                <div className="jp-learn-big">{view.instruction}</div>
              ) : view.kind === "formal" && view.round === 2 ? (
                <div className="jp-learn-big">Listen</div>
              ) : view.kind !== "formal" ? (
                <div className="jp-learn-big">Listen</div>
              ) : null}

              {!(view.kind === "formal" && (view.mode === "type-english" || view.mode === "type-romaji")) ? (
                <p className="jp-learn-sub">{view.instruction}</p>
              ) : view.kind === "formal" && view.mode === "type-english" ? (
                <p className="jp-learn-sub">Case, punctuation, equivalents, and minor typos are accepted.</p>
              ) : view.kind === "formal" && view.mode === "type-romaji" ? (
                <p className="jp-learn-sub">{view.instruction}</p>
              ) : null}

              {(() => {
                const word = words[currentWord.index];
                const hasNuance = wordHasNuanceExplanation(word);
                const trainingRound = getTrainingRound(view);
                if (!hasNuance || trainingRound >= 4) return null;
                return <JapaneseWordNuance word={word} />;
              })()}

              {!(view.kind === "formal" && view.mode === "type-romaji") ? (
                <button
                  type="button"
                  className="jp-learn-btn jp-learn-btn-primary"
                  onClick={playCurrentWordAudio}
                >
                  Play audio
                </button>
              ) : null}

              {view.kind !== "formal" || view.mode === "choices" ? (
                <div className="jp-learn-choices">
                  {view.choicePool.map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`jp-learn-btn jp-learn-choice ${
                        choiceStates[idx] === "correct"
                          ? "jp-learn-choice-correct"
                          : choiceStates[idx] === "wrong"
                            ? "jp-learn-choice-wrong"
                            : ""
                      }`}
                      onClick={() => handleChoice(idx)}
                      disabled={answered}
                    >
                      {words[idx].en}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <input
                    ref={inputRef}
                    className="jp-learn-input"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={
                      view.mode === "type-english"
                        ? "Type the English meaning"
                        : "Type Japanese in romaji, e.g. iku"
                    }
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!answered) handleCheckTyped();
                        else handleContinue();
                      }
                    }}
                    disabled={answered}
                  />
                  <div className="jp-learn-row mt-2">
                    <button
                      type="button"
                      className="jp-learn-btn jp-learn-btn-primary"
                      onClick={handleCheckTyped}
                      disabled={answered}
                    >
                      Check answer
                    </button>
                  </div>
                </>
              )}

              <div className="jp-learn-status">{status}</div>

              {showReveal && currentWord ? (
                <div className="jp-learn-reveal">
                  <div className="jp-learn-jp">{currentWord.jp}</div>
                  <div className="jp-learn-romaji">{currentWord.displayRomaji}</div>
                  <div className="jp-learn-english">{currentWord.en}</div>
                  {wasWrong &&
                  getTrainingRound(view) >= 4 &&
                  wordHasNuanceExplanation(words[currentWord.index]) ? (
                    <JapaneseWordNuance word={words[currentWord.index]} />
                  ) : null}
                  {wasWrong ? (
                    <>
                      <JapaneseMnemonicHook
                        blockNumber={block}
                        wordIndex={currentWord.index}
                        canonicalMnemonic={words[currentWord.index].m}
                        mnemonic={overrides[currentWord.index]?.mnemonic}
                        onMnemonicChange={handleMnemonicChange}
                        autoEdit
                      />
                      <button
                        type="button"
                        className="jp-learn-btn mt-2"
                        onClick={playCurrentWordAudio}
                      >
                        Replay audio
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}

              {answered && !roundComplete ? (
                <button type="button" className="jp-learn-btn mt-3" onClick={handleContinue}>
                  Continue
                </button>
              ) : null}
            </>
          ) : (
            <div className="jp-learn-stuck">
              <div className="jp-learn-big">Pick a round to continue</div>
              <p className="jp-learn-sub">
                Your session is between steps. Choose a round above to retry Block {block}.
              </p>
              <div className="jp-learn-row mt-3" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
                {activeRound >= 2 ? (
                  <button
                    type="button"
                    className="jp-learn-btn jp-learn-btn-primary"
                    onClick={() => selectRound(activeRound as 1 | 2 | 3 | 4 | 5)}
                    disabled={pending}
                  >
                    Retry Round {activeRound}
                  </button>
                ) : null}
                {highestRoundReached >= 4 ? (
                  <button
                    type="button"
                    className="jp-learn-btn"
                    onClick={() => selectRound(4)}
                    disabled={pending}
                  >
                    Practice Round 4
                  </button>
                ) : null}
                {highestRoundReached >= 5 ? (
                  <button
                    type="button"
                    className="jp-learn-btn"
                    onClick={() => selectRound(5)}
                    disabled={pending}
                  >
                    Practice Round 5
                  </button>
                ) : null}
              </div>
            </div>
          )}
          </section>
        </>
      ) : (
        <JapaneseWordList
          blockNumber={block}
          words={words}
          overrides={overrides}
          wordStats={wordStats}
          onOverrideChange={(wordIndex, field, value) => {
            setOverrides((prev) => ({
              ...prev,
              [wordIndex]: { ...prev[wordIndex], [field]: value },
            }));
          }}
        />
      )}
      <footer className="jp-learn-footer">
        <button
          type="button"
          className="jp-learn-btn jp-learn-btn-danger"
          onClick={handleReset}
          disabled={pending}
        >
          Reset progress
        </button>
        <p className="jp-learn-sub">Clears training progress for Block {block}. Word edits are kept.</p>
      </footer>
    </div>
  );
}
