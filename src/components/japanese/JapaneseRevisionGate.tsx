"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { getJapaneseBlock } from "@/lib/japanese/blocks";
import { fuzzyMatchEnglish, fuzzyMatchRomaji } from "@/lib/japanese/matching";
import { matchRevisionSentence } from "@/lib/japanese/revision-sentence-match";
import { playWordAudio } from "@/lib/japanese/tts";
import { resolveWord } from "@/lib/japanese/engine";
import { buildPlayAudioDebug } from "@/lib/japanese/word-helpers";
import {
  loadRevisionGate,
  submitRevisionAnswers,
  type RevisionGatePayload,
  type RevisionQuestion,
  type RevisionSubmitResult,
  type RevisionWordQuestion,
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

export function JapaneseRevisionGate({ gateNumber, onPassed, onClose }: Props) {
  const [payload, setPayload] = useState<RevisionGatePayload | null>(null);
  const [phase, setPhase] = useState<Phase>("quiz");
  const [qIndex, setQIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [modes, setModes] = useState<Record<string, "type-english" | "type-romaji">>({});
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<RevisionSubmitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [sentencePassed, setSentencePassed] = useState(false);
  const [revealedRomaji, setRevealedRomaji] = useState<string | null>(null);
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    setLoading(true);
    setStatus("");
    setPhase("quiz");
    setQIndex(0);
    setAnswers({});
    setTyped("");
    setResult(null);
    setSentencePassed(false);
    setRevealedRomaji(null);
    setPendingAnswers(null);
    loadRevisionGate(gateNumber)
      .then((data) => {
        if ("error" in data) {
          setStatus(data.error);
          setPayload(null);
          setLoading(false);
          return;
        }
        setPayload(data);
        const modeMap: Record<string, "type-english" | "type-romaji"> = {};
        for (const q of data.questions) {
          if (isWordQuestion(q)) modeMap[q.id] = q.mode;
        }
        setModes(modeMap);
        setLoading(false);
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
    setResult(null);
    setSentencePassed(false);
    setRevealedRomaji(null);
    setPendingAnswers(null);
    loadRevisionGate(gateNumber)
      .then((data) => {
        if ("error" in data) {
          setStatus(data.error);
          setPayload(null);
          setLoading(false);
          return;
        }
        setPayload(data);
        const modeMap: Record<string, "type-english" | "type-romaji"> = {};
        for (const q of data.questions) {
          if (isWordQuestion(q)) modeMap[q.id] = q.mode;
        }
        setModes(modeMap);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[JapaneseRevisionGate] reload failed", err);
        setStatus("Couldn't load revision checkpoint. Please try again.");
        setPayload(null);
        setLoading(false);
      });
  };

  const current = payload?.questions[qIndex];
  const isSentence = current?.kind === "sentence";
  const wordCount = payload?.questions.filter(isWordQuestion).length ?? 0;
  const sentenceCount = (payload?.questions.length ?? 0) - wordCount;

  const playCurrentAudio = useCallback(() => {
    if (!current || !isWordQuestion(current) || current.mode !== "type-english") return;
    const word = getJapaneseBlock(current.blockNumber)[current.wordIndex];
    if (!word) return;
    const resolved = resolveWord(word, current.wordIndex);
    playWordAudio(resolved.speakText, buildPlayAudioDebug(word, current.wordIndex));
  }, [current]);

  useEffect(() => {
    if (!current || !isWordQuestion(current) || current.mode !== "type-english") return;
    const timer = setTimeout(playCurrentAudio, 300);
    return () => clearTimeout(timer);
  }, [current, playCurrentAudio]);

  useEffect(() => {
    setSentencePassed(false);
    setRevealedRomaji(null);
    setPendingAnswers(null);
    setTyped("");
    setStatus("");
  }, [qIndex]);

  const advanceOrSubmit = (nextAnswers: Record<string, string>) => {
    if (!payload) return;
    if (qIndex + 1 < payload.questions.length) {
      setQIndex(qIndex + 1);
      return;
    }

    startTransition(async () => {
      const res = await submitRevisionAnswers(gateNumber, {
        answers: nextAnswers,
        modes,
      });
      if ("error" in res) {
        setStatus(res.error);
        return;
      }
      setResult(res);
      setPhase("results");
      if (res.passed) onPassed(res.unlocksBlock);
    });
  };

  const saveAndAdvance = () => {
    if (!payload || !current || !typed.trim()) {
      setStatus("Type an answer first.");
      return;
    }

    if (isSentence) {
      const ok = matchRevisionSentence(typed, current.requiredWords);
      if (!ok) {
        playIncorrectAnswerSound();
        setStatus("Not quite — use every word from the bank (any order).");
        return;
      }
      playCorrectAnswerSound();
      const nextAnswers = { ...answers, [current.id]: typed.trim() };
      setAnswers(nextAnswers);
      setPendingAnswers(nextAnswers);
      setSentencePassed(true);
      setRevealedRomaji(current.canonicalRomaji);
      setStatus("");
      return;
    }

    const word = getJapaneseBlock(current.blockNumber)[current.wordIndex];
    if (!word) return;
    const ok =
      current.mode === "type-english"
        ? fuzzyMatchEnglish(typed, word)
        : fuzzyMatchRomaji(typed, word);
    if (ok) playCorrectAnswerSound();
    else playIncorrectAnswerSound();

    const nextAnswers = { ...answers, [current.id]: typed.trim() };
    setAnswers(nextAnswers);
    setTyped("");
    setStatus("");
    advanceOrSubmit(nextAnswers);
  };

  const continueAfterSentence = () => {
    if (!payload || !current || current.kind !== "sentence" || !pendingAnswers) return;
    advanceOrSubmit(pendingAnswers);
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
          {payload.passed && result.passed ? (
            <p className="jp-learn-sub mt-2">You already passed this checkpoint — practice anytime.</p>
          ) : null}
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
          {payload.label} · {payload.sampleSize} word questions from the{" "}
          {payload.wordCount}-word pool + {sentenceCount} sentences · {payload.threshold}% to
          pass
        </p>
        <p className="jp-learn-sub">
          Romaji-first drill drawn from blocks {(gateNumber - 1) * 5 + 1}–{gateNumber * 5}. Mix of
          type-the-Japanese and type-the-meaning, then sentence building.
        </p>
      </header>
      <section className="jp-learn-card">
        <div className="jp-learn-meta">
          {sentenceSection === "sentence" ? "Sentence building · " : null}
          Question {qIndex + 1} of {payload.questions.length}
        </div>
        <div className="jp-learn-progress">
          <div style={{ width: `${((qIndex + 1) / payload.questions.length) * 100}%` }} />
        </div>
        {isSentence ? (
          <>
            <div className="jp-learn-big">BUILD A SENTENCE (ROMAJI)</div>
            <div className="jp-learn-prompt-en">{current.promptEnglish}</div>
            <p className="jp-learn-sub mt-2">
              Use these words in any order (grammar does not need to be perfect):
            </p>
            <div className="jp-learn-row" style={{ flexWrap: "wrap", gap: "0.35rem" }}>
              {current.wordBank.map((word) => (
                <span key={word} className="jp-learn-btn" style={{ cursor: "default" }}>
                  {word}
                </span>
              ))}
            </div>
            {revealedRomaji ? (
              <div className="mt-3">
                <p className="jp-learn-sub">Model sentence (word order):</p>
                <div className="jp-learn-romaji-xl">{revealedRomaji}</div>
              </div>
            ) : null}
          </>
        ) : current.mode === "type-english" ? (
          <>
            <div className="jp-learn-big">LISTEN AND TYPE THE MEANING</div>
            <div className="jp-learn-romaji-xl">{current.prompt}</div>
            <button type="button" className="jp-learn-btn jp-learn-btn-primary" onClick={playCurrentAudio}>
              Play audio
            </button>
          </>
        ) : (
          <>
            <div className="jp-learn-big">TYPE THE JAPANESE WORD</div>
            <div className="jp-learn-prompt-en">{current.prompt}</div>
          </>
        )}
        {!sentencePassed ? (
          <input
            className="jp-learn-input mt-3"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveAndAdvance();
            }}
            disabled={pending}
            autoFocus
            placeholder={isSentence ? "Type romaji words separated by spaces" : undefined}
          />
        ) : null}
        {status ? <p className="jp-learn-sub mt-2">{status}</p> : null}
        <div className="jp-learn-row mt-3">
          {sentencePassed ? (
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-primary"
              onClick={continueAfterSentence}
              disabled={pending}
            >
              {qIndex + 1 >= payload.questions.length ? "Submit revision" : "Next"}
            </button>
          ) : (
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-primary"
              onClick={saveAndAdvance}
              disabled={pending}
            >
              {isSentence
                ? "Check sentence"
                : qIndex + 1 >= payload.questions.length
                  ? "Submit revision"
                  : "Next"}
            </button>
          )}
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
