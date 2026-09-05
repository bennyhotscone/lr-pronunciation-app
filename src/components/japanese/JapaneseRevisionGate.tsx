"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ParticleSentenceBuilder } from "@/components/japanese/ParticleSentenceBuilder";
import { speakJapanese } from "@/lib/japanese/tts";
import {
  formatPreferredRomaji,
  matchAcceptedSentenceAnswers,
} from "@/lib/japanese/revision-sentence-match";
import { fuzzyMatchEnglish, fuzzyMatchRomaji } from "@/lib/japanese/matching";
import {
  clearRevisionInProgress,
  loadRevisionGate,
  saveRevisionInProgress,
  submitRevisionAnswers,
  type RevisionGatePayload,
  type RevisionQuestion,
  type RevisionSubmitResult,
  type RevisionWordQuestion,
  type RevisionSentenceQuestion,
} from "@/lib/japanese-revision-actions";
import {
  playCorrectAnswerSound,
  playIncorrectAnswerSound,
} from "@/lib/correct-answer-sound";
import "./japanese-learning.css";

type Phase = "quiz" | "results";

type Props = {
  gateNumber: number;
  onPassed: (unlocksBlock: number) => void;
  onClose?: () => void;
};

function isWordQuestion(q: RevisionQuestion): q is RevisionWordQuestion {
  return q.kind === "word";
}

function isSentenceQuestion(q: RevisionQuestion): q is RevisionSentenceQuestion {
  return q.kind === "sentence";
}

const LS_PREFIX = "jp-revision-inprogress-v1:";

export function JapaneseRevisionGate({ gateNumber, onPassed, onClose }: Props) {
  const [payload, setPayload] = useState<RevisionGatePayload | null>(null);
  const [phase, setPhase] = useState<Phase>("quiz");
  const [qIndex, setQIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [selectedTiles, setSelectedTiles] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [modes, setModes] = useState<Record<string, "type-english" | "type-romaji">>({});
  const [coveredWordIds, setCoveredWordIds] = useState<Set<string>>(new Set());
  const [revealedMnemonicIds, setRevealedMnemonicIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<RevisionSubmitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [mnemonicRevealed, setMnemonicRevealed] = useState(false);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    yourAnswer?: string;
    natural?: string;
  } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistProgress = useCallback(
    (
      next: {
        questions: RevisionQuestion[];
        qIndex: number;
        answers: Record<string, string>;
        modes: Record<string, "type-english" | "type-romaji">;
        coveredWordIds: string[];
        revealedMnemonicIds: string[];
      },
    ) => {
      const state = { ...next, savedAt: new Date().toISOString() };
      try {
        localStorage.setItem(`${LS_PREFIX}${gateNumber}`, JSON.stringify(state));
      } catch {
        /* ignore quota */
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveRevisionInProgress(gateNumber, state);
      }, 400);
    },
    [gateNumber],
  );

  const applyPayload = (data: RevisionGatePayload, forceFresh = false) => {
    let working = data;

    if (!forceFresh && data.resume) {
      setPayload(data);
      const modeMap: Record<string, "type-english" | "type-romaji"> = {};
      for (const q of data.questions) {
        if (isWordQuestion(q)) modeMap[q.id] = q.mode;
      }
      setQIndex(data.resume.qIndex);
      setAnswers(data.resume.answers);
      setModes({ ...modeMap, ...data.resume.modes });
      setCoveredWordIds(new Set(data.resume.coveredWordIds));
      setRevealedMnemonicIds(new Set(data.resume.revealedMnemonicIds));
      setLoading(false);
      return;
    }

    if (!forceFresh) {
      try {
        const raw = localStorage.getItem(`${LS_PREFIX}${gateNumber}`);
        if (raw) {
          const saved = JSON.parse(raw) as {
            questions?: RevisionQuestion[];
            qIndex?: number;
            answers?: Record<string, string>;
            modes?: Record<string, "type-english" | "type-romaji">;
            coveredWordIds?: string[];
            revealedMnemonicIds?: string[];
          };
          if (
            Array.isArray(saved.questions) &&
            saved.questions.length > 0 &&
            typeof saved.qIndex === "number" &&
            saved.qIndex < saved.questions.length
          ) {
            working = {
              ...data,
              questions: saved.questions,
              resume: undefined,
            };
            setPayload(working);
            const modeMap: Record<string, "type-english" | "type-romaji"> = {};
            for (const q of working.questions) {
              if (isWordQuestion(q)) modeMap[q.id] = q.mode;
            }
            setQIndex(saved.qIndex);
            setAnswers(saved.answers ?? {});
            setModes({ ...modeMap, ...(saved.modes ?? {}) });
            setCoveredWordIds(new Set(saved.coveredWordIds ?? []));
            setRevealedMnemonicIds(new Set(saved.revealedMnemonicIds ?? []));
            setLoading(false);
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }

    setPayload(working);
    const modeMap: Record<string, "type-english" | "type-romaji"> = {};
    for (const q of working.questions) {
      if (isWordQuestion(q)) modeMap[q.id] = q.mode;
    }
    setModes(modeMap);
    setCoveredWordIds(new Set());
    setRevealedMnemonicIds(new Set());
    setQIndex(0);
    setAnswers({});
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    setStatus("");
    setPhase("quiz");
    setFeedback(null);
    setMnemonicRevealed(false);
    loadRevisionGate(gateNumber)
      .then((data) => {
        if ("error" in data) {
          setStatus(data.error);
          setPayload(null);
          setLoading(false);
          return;
        }
        applyPayload(data);
      })
      .catch((err) => {
        console.error("[JapaneseRevisionGate] load failed", err);
        setStatus("Couldn't load revision checkpoint. Please try again.");
        setPayload(null);
        setLoading(false);
      });
  }, [gateNumber]);

  const current = payload?.questions[qIndex];
  const isSentence = current ? isSentenceQuestion(current) : false;
  const currentRound = current?.round ?? 1;

  const coverageTotal = payload?.coverageWordIds.length ?? payload?.wordCount ?? 0;
  const coverageDone = coveredWordIds.size;

  const playCurrentAudio = useCallback(() => {
    if (!current || !isWordQuestion(current)) return;
    speakJapanese(current.audio || current.romaji);
  }, [current]);

  useEffect(() => {
    if (!current || !isWordQuestion(current) || current.mode !== "type-english") return;
    const timer = setTimeout(playCurrentAudio, 300);
    return () => clearTimeout(timer);
  }, [current, playCurrentAudio]);

  useEffect(() => {
    setFeedback(null);
    setTyped("");
    setSelectedTiles([]);
    setStatus("");
    setMnemonicRevealed(
      !!(current && isWordQuestion(current) && revealedMnemonicIds.has(current.id)),
    );
  }, [qIndex, current, revealedMnemonicIds]);

  const snapshot = useCallback(() => {
    if (!payload) return null;
    return {
      questions: payload.questions,
      qIndex,
      answers,
      modes,
      coveredWordIds: [...coveredWordIds],
      revealedMnemonicIds: [...revealedMnemonicIds],
    };
  }, [payload, qIndex, answers, modes, coveredWordIds, revealedMnemonicIds]);

  const submitAll = (nextAnswers: Record<string, string>, covered: Set<string>) => {
    if (!payload) return;
    startTransition(async () => {
      const res = await submitRevisionAnswers(gateNumber, {
        answers: nextAnswers,
        modes,
        coveredWordIds: [...covered],
      });
      if ("error" in res && res.error) {
        setStatus(res.error);
        return;
      }
      if ("error" in res) {
        setStatus("Couldn't submit revision.");
        return;
      }
      try {
        localStorage.removeItem(`${LS_PREFIX}${gateNumber}`);
      } catch {
        /* ignore */
      }
      void clearRevisionInProgress(gateNumber);
      setResult(res);
      setPhase("results");
      if (res.passed) onPassed(res.unlocksBlock);
    });
  };

  const advanceAfterFeedback = () => {
    if (!payload || !current) return;
    const nextIndex = qIndex + 1;
    if (nextIndex < payload.questions.length) {
      setQIndex(nextIndex);
      const snap = snapshot();
      if (snap) persistProgress({ ...snap, qIndex: nextIndex });
      return;
    }
    submitAll(answers, coveredWordIds);
  };

  const revealMnemonic = () => {
    if (!current || !isWordQuestion(current) || current.round !== 1) return;
    setMnemonicRevealed(true);
    const next = new Set(revealedMnemonicIds);
    next.add(current.id);
    setRevealedMnemonicIds(next);
    const snap = snapshot();
    if (snap) {
      persistProgress({
        ...snap,
        revealedMnemonicIds: [...next],
      });
    }
  };

  const checkWordAnswer = () => {
    if (!payload || !current || !isWordQuestion(current) || !typed.trim()) {
      setStatus("Type an answer first.");
      return;
    }
    const ok =
      current.mode === "type-english"
        ? fuzzyMatchEnglish(typed, {
            jp: "",
            audio: current.audio,
            r: current.romaji,
            en: current.english,
            m: current.mnemonic,
          })
        : fuzzyMatchRomaji(typed, {
            jp: "",
            audio: current.audio,
            r: current.romaji,
            en: current.english,
            m: current.mnemonic,
          });

    if (ok) playCorrectAnswerSound();
    else playIncorrectAnswerSound();
    speakJapanese(current.audio || current.romaji);

    const nextCovered = new Set(coveredWordIds);
    nextCovered.add(current.wordId);
    setCoveredWordIds(nextCovered);

    const nextRevealed = new Set(revealedMnemonicIds);
    nextRevealed.add(current.id);
    setRevealedMnemonicIds(nextRevealed);

    const nextAnswers = { ...answers, [current.id]: typed.trim() };
    setAnswers(nextAnswers);
    setFeedback({
      correct: ok,
      yourAnswer: ok ? undefined : typed.trim(),
    });
    setMnemonicRevealed(true);
    setStatus("");

    persistProgress({
      questions: payload.questions,
      qIndex,
      answers: nextAnswers,
      modes,
      coveredWordIds: [...nextCovered],
      revealedMnemonicIds: [...nextRevealed],
    });
  };

  const checkSentenceAnswer = () => {
    if (!payload || !current || !isSentenceQuestion(current)) return;
    if (!selectedTiles.length) {
      setStatus("Tap tiles to build your answer.");
      return;
    }
    const match = matchAcceptedSentenceAnswers(
      selectedTiles,
      current.preferredAnswer,
      current.acceptedAnswers,
    );
    if (!match.ok) {
      playIncorrectAnswerSound();
      setStatus("Not quite — try different tiles (particles optional).");
      return;
    }
    playCorrectAnswerSound();
    const natural = formatPreferredRomaji(current.preferredAnswer);
    speakJapanese(natural);
    const nextAnswers = { ...answers, [current.id]: selectedTiles.join(" ") };
    setAnswers(nextAnswers);
    setFeedback({
      correct: true,
      natural: match.caveman ? natural : undefined,
    });
    setStatus("");
    persistProgress({
      questions: payload.questions,
      qIndex,
      answers: nextAnswers,
      modes,
      coveredWordIds: [...coveredWordIds],
      revealedMnemonicIds: [...revealedMnemonicIds],
    });
  };

  const restartQuiz = () => {
    try {
      localStorage.removeItem(`${LS_PREFIX}${gateNumber}`);
    } catch {
      /* ignore */
    }
    setLoading(true);
    setStatus("");
    setPhase("quiz");
    setQIndex(0);
    setAnswers({});
    setTyped("");
    setSelectedTiles([]);
    setResult(null);
    setFeedback(null);
    setCoveredWordIds(new Set());
    setRevealedMnemonicIds(new Set());
    void (async () => {
      await clearRevisionInProgress(gateNumber);
      try {
        const data = await loadRevisionGate(gateNumber);
        if ("error" in data) {
          setStatus(data.error);
          setPayload(null);
          setLoading(false);
          return;
        }
        applyPayload({ ...data, resume: undefined }, true);
      } catch {
        setStatus("Couldn't reload.");
        setLoading(false);
      }
    })();
  };

  if (loading) {
    return <p className="text-muted">Loading revision quiz.</p>;
  }

  if (!payload) {
    return (
      <div className="jp-learn-wrap">
        <p className="text-muted">{status || "Revision unavailable."}</p>
        {onClose ? (
          <button type="button" className="jp-learn-btn mt-3" onClick={onClose}>
            Back
          </button>
        ) : null}
      </div>
    );
  }

  if (phase === "results" && result) {
    return (
      <div className="jp-learn-wrap">
        <header className="jp-learn-header">
          <h1 className="jp-learn-title">Revision checkpoint</h1>
          <p className="jp-learn-meta">{payload.label}</p>
        </header>
        <section className="jp-learn-card">
          <div className="jp-learn-big">
            {result.passed ? "Revision passed" : "Revision not passed yet"}
          </div>
          <p className="jp-learn-sub">
            Score: {result.scorePct}% ({result.correctCount}/{result.total}) · need{" "}
            {result.threshold}%
          </p>
          <p className="jp-learn-sub">
            Coverage: {result.coveredCount} / {result.coverageTotal} words reviewed
          </p>
          <button
            type="button"
            className="jp-learn-btn jp-learn-btn-primary mt-3"
            onClick={restartQuiz}
            disabled={pending}
          >
            {result.passed ? "Practice again" : "Try again"}
          </button>
          {onClose ? (
            <button type="button" className="jp-learn-btn mt-3" onClick={onClose}>
              Back to training
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  if (!current) return null;

  const showRevealBtn =
    isWordQuestion(current) &&
    current.round === 1 &&
    !feedback &&
    !mnemonicRevealed;

  const showMnemonicNow =
    isWordQuestion(current) &&
    (feedback || (current.round === 1 && mnemonicRevealed));

  return (
    <div className="jp-learn-wrap">
      <header className="jp-learn-header">
        <h1 className="jp-learn-title">Revision quiz</h1>
        <p className="jp-learn-meta">
          {payload.label} · Round {currentRound} of 2 · Question {qIndex + 1} of{" "}
          {payload.questions.length} · {payload.threshold}% to pass
        </p>
        <p className="jp-learn-sub">
          {coverageDone} / {coverageTotal} words reviewed
          {currentRound === 1
            ? " · Round 1: tap Reveal mnemonic if stuck"
            : " · Round 2: sentence after every 5 words"}
        </p>
      </header>
      <section className="jp-learn-card">
        <div className="jp-learn-progress">
          <div
            style={{
              width: `${payload.questions.length ? ((qIndex + 1) / payload.questions.length) * 100 : 0}%`,
            }}
          />
        </div>

        {isSentence && isSentenceQuestion(current) ? (
          <>
            <div className="jp-learn-big">SENTENCE — use the last 5 words</div>
            {!feedback ? (
              <ParticleSentenceBuilder
                instruction={current.promptEnglish}
                tiles={current.tiles}
                selected={selectedTiles}
                locked={false}
                onSelectedChange={setSelectedTiles}
                onClear={() => setSelectedTiles([])}
                onCheck={checkSentenceAnswer}
              />
            ) : (
              <div className="jp-learn-reveal mt-3">
                <div className="jp-mnemonic-feedback jp-mnemonic-feedback-ok">
                  ✓ Correct
                  {feedback.natural ? (
                    <div className="jp-learn-sub mt-2">
                      Natural Japanese: <strong>{feedback.natural}</strong>
                    </div>
                  ) : (
                    <div className="jp-learn-romaji-xl mt-2">{current.canonicalRomaji}</div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : isWordQuestion(current) ? (
          <>
            {current.mode === "type-english" ? (
              <>
                <div className="jp-learn-big">LISTEN AND TYPE THE MEANING</div>
                <div className="jp-learn-romaji-xl">{current.prompt}</div>
                <button
                  type="button"
                  className="jp-learn-btn jp-learn-btn-primary"
                  onClick={playCurrentAudio}
                >
                  Play audio
                </button>
              </>
            ) : (
              <>
                <div className="jp-learn-big">TYPE THE JAPANESE WORD</div>
                <div className="jp-learn-prompt-en">{current.prompt}</div>
              </>
            )}

            {showRevealBtn ? (
              <button type="button" className="jp-learn-btn mt-2" onClick={revealMnemonic}>
                Reveal mnemonic
              </button>
            ) : null}

            {showMnemonicNow && !feedback ? (
              <div className="jp-mnemonic-feedback jp-mnemonic-feedback-ok mt-2">
                <div className="jp-mnemonic-line">Mnemonic: {current.mnemonic}</div>
              </div>
            ) : null}

            {!feedback ? (
              <input
                className="jp-learn-input mt-3"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") checkWordAnswer();
                }}
                disabled={pending}
                autoFocus
              />
            ) : (
              <div className="jp-learn-reveal mt-3">
                {feedback.correct ? (
                  <div className="jp-mnemonic-feedback jp-mnemonic-feedback-ok">
                    <div>✓ {current.romaji}</div>
                    <div>{current.english}</div>
                    <div className="jp-mnemonic-line">Mnemonic: {current.mnemonic}</div>
                  </div>
                ) : (
                  <div className="jp-mnemonic-feedback jp-mnemonic-feedback-bad">
                    <div>✗ Your answer: {feedback.yourAnswer}</div>
                    <div>Correct: {current.romaji}</div>
                    <div>{current.english}</div>
                    <div className="jp-mnemonic-line">Mnemonic: {current.mnemonic}</div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}

        {status ? <p className="jp-learn-sub mt-2">{status}</p> : null}

        <div className="jp-learn-row mt-3">
          {!feedback && !isSentence ? (
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-primary"
              onClick={checkWordAnswer}
              disabled={pending}
            >
              Check
            </button>
          ) : null}
          {feedback ? (
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-primary"
              onClick={advanceAfterFeedback}
              disabled={pending}
            >
              {qIndex + 1 >= payload.questions.length ? "Submit revision" : "Continue"}
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              className="jp-learn-btn"
              onClick={() => {
                const snap = snapshot();
                if (snap) persistProgress(snap);
                onClose();
              }}
              disabled={pending}
            >
              Save &amp; exit
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
