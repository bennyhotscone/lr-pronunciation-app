"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  advanceAfterRound1Correct,
  advanceFormalQuestion,
  buildRoundView,
  getActiveRound,
  getHighestRoundReached,
  jumpToRound,
  recordCorrect,
  recordMiss,
  repairSessionState,
  resolveWord,
  retryRound,
  ROUND_SHORT_LABELS,
  startFormalRound,
  transitionRound1ToRound2,
  updateMetaAfterRound,
} from "@/lib/japanese/engine";
import {
  getJapaneseBlock,
  getPlayableBlockNumbers,
  isPlayableJapaneseBlock,
} from "@/lib/japanese/blocks";
import { getBlockCurriculumLabel } from "@/lib/japanese/blocks/frequency";
import {
  JAPANESE_MASTERY_THRESHOLD,
  JAPANESE_TOTAL_BLOCKS,
  JAPANESE_WORDS_PER_BLOCK,
} from "@/lib/japanese/config";
import {
  getBlockUnlockedByMilestone,
  getMilestoneForBlock,
} from "@/lib/japanese/milestone";
import { fuzzyMatchEnglish, fuzzyMatchRomaji } from "@/lib/japanese/matching";
import { cancelJapaneseSpeech, playWordAudio } from "@/lib/japanese/tts";
import { buildPlayAudioDebug } from "@/lib/japanese/word-helpers";
import type { JapaneseBlockMeta, JapaneseSessionState } from "@/lib/japanese/types";
import {
  loadJapaneseProgress,
  recordJapaneseWordResult,
  resetJapaneseBlockProgress,
  saveJapaneseProgress,
  type JapaneseProgressPayload,
} from "@/lib/japanese-actions";
import { JapaneseMnemonicHook } from "./JapaneseMnemonicHook";
import { JapaneseMilestoneGate } from "./JapaneseMilestoneGate";
import { JapaneseWordList } from "./JapaneseWordList";
import "./japanese-learning.css";

type Screen = "train" | "list" | "gate";

export function JapaneseLearningApp() {
  const [block, setBlock] = useState(1);
  const words = useMemo(() => getJapaneseBlock(block), [block]);
  const [screen, setScreen] = useState<Screen>("train");
  const [session, setSession] = useState<JapaneseSessionState | null>(null);
  const [meta, setMeta] = useState<JapaneseBlockMeta | null>(null);
  const [gatesPassed, setGatesPassed] = useState<number[]>([]);
  const [activeGate, setActiveGate] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<JapaneseProgressPayload["overrides"]>({});
  const [loading, setLoading] = useState(true);
  const [answered, setAnswered] = useState(false);
  const [status, setStatus] = useState("");
  const [showReveal, setShowReveal] = useState(false);
  const [revealCorrect, setRevealCorrect] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [choiceStates, setChoiceStates] = useState<Record<number, "correct" | "wrong" | null>>({});
  const [pending, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isPlayableJapaneseBlock(block)) return;
    setLoading(true);
    loadJapaneseProgress(block).then((data) => {
      if ("error" in data) {
        setLoading(false);
        return;
      }
      const repaired = repairSessionState(data.session, getJapaneseBlock(block).length);
      setSession(repaired);
      setMeta(data.meta);
      setGatesPassed(data.gatesPassed);
      setOverrides(data.overrides);
      setLoading(false);
      if (
        repaired.phase !== data.session.phase ||
        repaired.order.length !== data.session.order.length
      ) {
        void saveJapaneseProgress(block, repaired, data.meta);
      }
    });
  }, [block]);


  const playableBlocks = useMemo(() => getPlayableBlockNumbers(), []);

  const openMilestoneGate = (milestoneNumber: number) => {
    setActiveGate(milestoneNumber);
    setScreen("gate");
  };

  const switchBlock = (next: number) => {
    if (!meta) return;
    if (!meta.unlockedBlocks.includes(next) || !isPlayableJapaneseBlock(next)) {
      for (let m = 1; getBlockUnlockedByMilestone(m) <= next; m += 1) {
        if (getBlockUnlockedByMilestone(m) === next && !gatesPassed.includes(m)) {
          openMilestoneGate(m);
          return;
        }
      }
      return;
    }
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
    return buildRoundView(session, words, overrides);
  }, [session, words, overrides]);

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
    setRevealCorrect(false);
    setTypedAnswer("");
    setChoiceStates({});
  }, []);

  const selectRound = useCallback(
    (round: 1 | 2 | 3 | 4 | 5) => {
      if (!session || !meta) return;
      if (round > highestRoundReached) return;
      const nextSession = jumpToRound(session, round, words.length);
      resetQuestionUi();
      setSession(nextSession);
      persist(nextSession, meta);
      setScreen("train");
    },
    [session, meta, words.length, highestRoundReached, resetQuestionUi, persist],
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
      nextSession = recordCorrect(session);
      setStatus("Correct");
    } else {
      nextSession = recordMiss(session, correctIndex);
      setStatus(`Answer: ${words[correctIndex].en}`);
    }

    void recordJapaneseWordResult(block, correctIndex, correct);
    setRevealCorrect(!correct);
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
      nextSession = recordCorrect(session);
      setStatus("Accepted");
      if (view.mode === "type-romaji" && view.round === 5) {
        playWordAudioAtIndex(view.wordIndex);
      }
    } else {
      nextSession = recordMiss(session, view.wordIndex);
      setStatus(view.mode === "type-english" ? `Answer: ${word.en}` : `Answer: ${word.r}`);
      playCurrentWordAudio();
    }

    void recordJapaneseWordResult(block, view.wordIndex, correct);
    setRevealCorrect(!correct);
    setShowReveal(true);
    setSession(nextSession);
    persist(nextSession, meta);
  };

  const handleRetryRound = () => {
    if (!session || !meta || !view || view.kind !== "round-complete") return;
    const nextSession = retryRound(session, words.length);
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
            ? transitionRound1ToRound2(session, words.length)
            : startFormalRound(session, view.nextRound, words.length);
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
      const scorePct = Math.round((session.score / Math.max(nextSession.order.length, 1)) * 100);
      const nextMeta = updateMetaAfterRound(meta, block, round, scorePct);
      setSession(nextSession);
      setMeta(nextMeta);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      startTransition(async () => {
        await saveJapaneseProgress(block, nextSession, nextMeta);
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
      resetQuestionUi();
    });
  };

  const pendingGateMilestone = useMemo(() => {
    const milestone = getMilestoneForBlock(block);
    if (!milestone || !meta?.blockMastered) return null;
    if (gatesPassed.includes(milestone)) return null;
    return milestone;
  }, [block, meta?.blockMastered, gatesPassed]);

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
        {pendingGateMilestone ? (
          <div className="jp-learn-gate-banner" role="status">
            <p>
              Story checkpoint required to unlock Block{" "}
              {getBlockUnlockedByMilestone(pendingGateMilestone)}.
            </p>
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-gate"
              onClick={() => openMilestoneGate(pendingGateMilestone)}
            >
              Take story checkpoint
            </button>
          </div>
        ) : null}
        <nav className="jp-learn-block-nav" aria-label="Japanese blocks">
          {playableBlocks.map((n) => {
            const unlocked = meta.unlockedBlocks.includes(n);
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
                    {pendingGateMilestone ? (
                      <button
                        type="button"
                        className="jp-learn-btn jp-learn-btn-primary"
                        onClick={() => openMilestoneGate(pendingGateMilestone)}
                      >
                        Story checkpoint (unlock Block {getBlockUnlockedByMilestone(pendingGateMilestone)})
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

              {view.showMnemonic && view.kind !== "formal" ? (
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
                  {revealCorrect ? (
                    <>
                      <JapaneseMnemonicHook
                        blockNumber={block}
                        wordIndex={currentWord.index}
                        canonicalMnemonic={words[currentWord.index].m}
                        mnemonic={overrides[currentWord.index]?.mnemonic}
                        onMnemonicChange={handleMnemonicChange}
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
