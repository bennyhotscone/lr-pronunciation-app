"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { getJapaneseBlock } from "@/lib/japanese/blocks";
import { fuzzyMatchEnglish, fuzzyMatchRomaji } from "@/lib/japanese/matching";
import { playWordAudio } from "@/lib/japanese/tts";
import { resolveWord } from "@/lib/japanese/engine";
import { buildPlayAudioDebug } from "@/lib/japanese/word-helpers";
import {
  loadRevisionGate,
  submitRevisionAnswers,
  type RevisionGatePayload,
  type RevisionSubmitResult,
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

  useEffect(() => {
    setLoading(true);
    loadRevisionGate(gateNumber)
      .then((data) => {
        if ("error" in data) {
          setStatus(data.error);
          setLoading(false);
          return;
        }
        setPayload(data);
        const modeMap: Record<string, "type-english" | "type-romaji"> = {};
        for (const q of data.questions) modeMap[q.id] = q.mode;
        setModes(modeMap);
        if (data.passed) {
          setPhase("results");
          setResult({
            passed: true,
            scorePct: 100,
            threshold: data.threshold,
            correctCount: data.questions.length,
            total: data.questions.length,
            unlocksBlock: data.unlocksBlock,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("[JapaneseRevisionGate] loadRevisionGate failed", err);
        setStatus("Couldn't load revision checkpoint. Please try again.");
        setLoading(false);
      });
  }, [gateNumber]);

  const current = payload?.questions[qIndex];

  const playCurrentAudio = useCallback(() => {
    if (!current || current.mode !== "type-english") return;
    const word = getJapaneseBlock(current.blockNumber)[current.wordIndex];
    if (!word) return;
    const resolved = resolveWord(word, current.wordIndex);
    playWordAudio(resolved.speakText, buildPlayAudioDebug(word, current.wordIndex));
  }, [current]);

  useEffect(() => {
    if (!current || current.mode !== "type-english") return;
    const timer = setTimeout(playCurrentAudio, 300);
    return () => clearTimeout(timer);
  }, [current, playCurrentAudio]);

  const saveAndAdvance = () => {
    if (!payload || !current || !typed.trim()) {
      setStatus("Type an answer first.");
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
          ) : (
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-primary mt-3"
              onClick={() => {
                setPhase("quiz");
                setQIndex(0);
                setAnswers({});
                setTyped("");
                setResult(null);
              }}
              disabled={pending}
            >
              Try again
            </button>
          )}
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

  return (
    <div className="jp-learn-wrap">
      <header className="jp-learn-header">
        <h1 className="jp-learn-title">Revision required</h1>
        <p className="jp-learn-meta">
          {payload.label} · {payload.wordCount} words · need {payload.threshold}%
        </p>
        <p className="jp-learn-sub">
          Pass this all-words revision before Block {payload.unlocksBlock} opens.
        </p>
      </header>
      <section className="jp-learn-card">
        <div className="jp-learn-meta">
          Question {qIndex + 1} of {payload.questions.length}
        </div>
        <div className="jp-learn-progress">
          <div style={{ width: `${((qIndex + 1) / payload.questions.length) * 100}%` }} />
        </div>
        {current.mode === "type-english" ? (
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
        <input
          className="jp-learn-input mt-3"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveAndAdvance();
          }}
          disabled={pending}
          autoFocus
        />
        {status ? <p className="jp-learn-sub mt-2">{status}</p> : null}
        <div className="jp-learn-row mt-3">
          <button
            type="button"
            className="jp-learn-btn jp-learn-btn-primary"
            onClick={saveAndAdvance}
            disabled={pending}
          >
            {qIndex + 1 >= payload.questions.length ? "Submit revision" : "Next"}
          </button>
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
