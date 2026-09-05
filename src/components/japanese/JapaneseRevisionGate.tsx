"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ParticleSentenceBuilder } from "@/components/japanese/ParticleSentenceBuilder";
import { speakJapanese } from "@/lib/japanese/tts";
import {
  formatPreferredRomaji,
  matchAcceptedSentenceAnswers,
} from "@/lib/japanese/revision-sentence-match";
import { fuzzyMatchEnglish, fuzzyMatchRomaji } from "@/lib/japanese/matching";
import {
  loadRevisionGate,
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

export function JapaneseRevisionGate({ gateNumber, onPassed, onClose }: Props) {
  const [payload, setPayload] = useState<RevisionGatePayload | null>(null);
  const [phase, setPhase] = useState<Phase>("quiz");
  const [qIndex, setQIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [selectedTiles, setSelectedTiles] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [modes, setModes] = useState<Record<string, "type-english" | "type-romaji">>({});
  const [coveredWordIds, setCoveredWordIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<RevisionSubmitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    yourAnswer?: string;
    natural?: string;
  } | null>(null);

  const applyPayload = (data: RevisionGatePayload) => {
    setPayload(data);
    const modeMap: Record<string, "type-english" | "type-romaji"> = {};
    for (const q of data.questions) {
      if (isWordQuestion(q)) modeMap[q.id] = q.mode;
    }
    setModes(modeMap);
    setCoveredWordIds(new Set());
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    setStatus("");
    setPhase("quiz");
    setQIndex(0);
    setAnswers({});
    setTyped("");
    setSelectedTiles([]);
    setResult(null);
    setFeedback(null);
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
        console.error("[JapaneseRevisionGate] loadRevisionGate failed", err);
        setStatus("Couldn't load revision checkpoint. Please try again.");
        setPayload(null);
        setLoading(false);
      });
  }, [gateNumber]);

  const restartQuiz = () => {
    setLoading(true);
    setStatus("");
    setPhase("quiz");
    setQIndex(0);
    setAnswers({});
    setTyped("");
    setSelectedTiles([]);
    setResult(null);
    setFeedback(null);
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
        console.error("[JapaneseRevisionGate] reload failed", err);
        setStatus("Couldn't load revision checkpoint. Please try again.");
        setPayload(null);
        setLoading(false);
      });
  };

  const current = payload?.questions[qIndex];
  const isSentence = current ? isSentenceQuestion(current) : false;
  const wordCount = payload?.questions.filter(isWordQuestion).length ?? 0;
  const sentenceCount = (payload?.questions.length ?? 0) - wordCount;

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
  }, [qIndex]);

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
      setResult(res);
      setPhase("results");
      if (res.passed) onPassed(res.unlocksBlock);
    });
  };

  const advanceAfterFeedback = () => {
    if (!payload || !current) return;
    if (qIndex + 1 < payload.questions.length) {
      setQIndex(qIndex + 1);
      return;
    }
    submitAll(answers, coveredWordIds);
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

    const nextAnswers = { ...answers, [current.id]: typed.trim() };
    setAnswers(nextAnswers);
    setFeedback({
      correct: ok,
      yourAnswer: ok ? undefined : typed.trim(),
    });
    setStatus("");
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
          {result.passed ? (
            <p className="jp-learn-sub">Block {result.unlocksBlock} is now unlocked.</p>
          ) : null}
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

  const sentenceSection =
    sentenceCount > 0 && qIndex >= wordCount ? "sentence" : "word";

  return (
    <div className="jp-learn-wrap">
      <header className="jp-learn-header">
        <h1 className="jp-learn-title">Revision quiz</h1>
        <p className="jp-learn-meta">
          {payload.label} · full {payload.wordCount}-word coverage + {sentenceCount} sentences ·{" "}
          {payload.threshold}% to pass
        </p>
        <p className="jp-learn-sub">
          {coverageDone} / {coverageTotal} words reviewed
        </p>
      </header>
      <section className="jp-learn-card">
        <div className="jp-learn-meta">
          {sentenceSection === "sentence" ? "Sentence building · " : null}
          Question {qIndex + 1} of {payload.questions.length}
        </div>
        <div className="jp-learn-progress">
          <div
            style={{
              width: `${coverageTotal ? (coverageDone / coverageTotal) * 100 : 0}%`,
            }}
          />
        </div>

        {isSentence && isSentenceQuestion(current) ? (
          <>
            <div className="jp-learn-big">BUILD A SENTENCE</div>
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
            <button type="button" className="jp-learn-btn" onClick={onClose} disabled={pending}>
              Cancel
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
