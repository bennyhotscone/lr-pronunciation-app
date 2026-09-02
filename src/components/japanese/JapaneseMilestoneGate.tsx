"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { JAPANESE_MILESTONE_PASS_THRESHOLD } from "@/lib/japanese/config";
import type { MilestoneTtsToken } from "@/lib/japanese/milestone-story";
import { cancelJapaneseSpeech, speakJapaneseWordByWord } from "@/lib/japanese/tts";
import {
  loadMilestoneGate,
  submitMilestoneAnswers,
  type MilestoneStoryPayload,
  type MilestoneSubmitResult,
} from "@/lib/japanese-milestone-actions";
import "./japanese-learning.css";

type Phase = "story" | "comprehension" | "production" | "results";

type Props = {
  milestoneNumber: number;
  onPassed: (unlocksBlock: number) => void;
  onClose?: () => void;
};

function audioTokens(line: MilestoneTtsToken[]): string[] {
  return line.map((t) => t.audio || t.romaji);
}

export function JapaneseMilestoneGate({ milestoneNumber, onPassed, onClose }: Props) {
  const [payload, setPayload] = useState<MilestoneStoryPayload | null>(null);
  const [phase, setPhase] = useState<Phase>("story");
  const [compIndex, setCompIndex] = useState(0);
  const [prodIndex, setProdIndex] = useState(0);
  const [compAnswers, setCompAnswers] = useState<Record<string, string>>({});
  const [prodAnswers, setProdAnswers] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<MilestoneSubmitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setLoading(true);
    loadMilestoneGate(milestoneNumber)
      .then((data) => {
        if ("error" in data) {
          setStatus(data.error);
          setLoading(false);
          return;
        }
        setPayload(data);
        if (data.passed) {
          setPhase("results");
          setResult({
            passed: true,
            comprehensionScore: 100,
            productionScore: 100,
            combinedScore: 100,
            threshold: JAPANESE_MILESTONE_PASS_THRESHOLD,
            unlocksBlock: data.unlocksBlock,
            comprehensionResults: {},
            productionResults: {},
            comprehensionFeedback: {},
            productionFeedback: {},
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("[JapaneseMilestoneGate] loadMilestoneGate failed", err);
        setStatus("Couldn't load vocab checkpoint. Please try again.");
        setLoading(false);
      });
    return () => cancelJapaneseSpeech();
  }, [milestoneNumber]);

  const playParagraph = useCallback((paragraphIndex: number) => {
    if (!payload) return;
    const line = payload.story.ttsLines[paragraphIndex];
    if (!line?.length) return;
    speakJapaneseWordByWord(audioTokens(line), { pauseMs: 800 });
  }, [payload]);

  const playAll = useCallback(() => {
    if (!payload) return;
    const allAudio = payload.story.ttsLines.flatMap(audioTokens);
    speakJapaneseWordByWord(allAudio, { pauseMs: 800 });
  }, [payload]);

  const currentComp = payload?.story.comprehension[compIndex];
  const currentProd = payload?.story.production[prodIndex];

  const submitGate = () => {
    if (!payload) return;
    startTransition(async () => {
      const res = await submitMilestoneAnswers(milestoneNumber, {
        comprehension: compAnswers,
        production: prodAnswers,
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

  const saveCompAnswer = () => {
    if (!currentComp || !typed.trim()) {
      setStatus("Type your answer in English.");
      return;
    }
    const next = { ...compAnswers, [currentComp.id]: typed.trim() };
    setCompAnswers(next);
    setTyped("");
    setStatus("");
    if (compIndex + 1 < (payload?.story.comprehension.length ?? 0)) {
      setCompIndex(compIndex + 1);
    } else {
      setPhase("production");
      setProdIndex(0);
    }
  };

  const saveProdAnswer = () => {
    if (!currentProd || !typed.trim()) {
      setStatus("Type the romaji.");
      return;
    }
    const next = { ...prodAnswers, [currentProd.id]: typed.trim() };
    setProdAnswers(next);
    setTyped("");
    setStatus("");
    if (prodIndex + 1 < (payload?.story.production.length ?? 0)) {
      setProdIndex(prodIndex + 1);
    } else {
      submitGate();
    }
  };

  if (loading) {
    return <p className="text-muted">Preparing your vocab checkpoint…</p>;
  }

  if (!payload) {
    return <p className="text-muted">{status || "Could not load checkpoint."}</p>;
  }

  return (
    <div className="jp-learn-wrap jp-learn-gate-wrap">
      <header className="jp-learn-header jp-learn-gate-header">
        <div className="jp-learn-meta">Vocab checkpoint</div>
        <h1 className="jp-learn-title">{payload.story.title}</h1>
        <p className="jp-learn-sub">
          {payload.label} vocabulary · Pass at {JAPANESE_MILESTONE_PASS_THRESHOLD}% to unlock Block{" "}
          {payload.unlocksBlock}
        </p>
        {onClose ? (
          <button type="button" className="jp-learn-btn mt-3" onClick={onClose} disabled={pending}>
            Back to training
          </button>
        ) : null}
      </header>

      <div className="jp-learn-card jp-learn-gate-card">
        {phase === "story" ? (
          <>
            <p className="jp-learn-sub">
              Review the words you practiced (romaji only). Tap play to hear each word spoken slowly,
              one at a time.
            </p>
            <div className="jp-learn-row mt-3">
              <button type="button" className="jp-learn-btn jp-learn-btn-gate" onClick={playAll}>
                Play all words
              </button>
            </div>
            {payload.story.paragraphs.map((p, i) => (
              <div key={i} style={{ marginTop: "1rem" }}>
                <p className="jp-learn-romaji-lg" style={{ lineHeight: 1.8, whiteSpace: "pre-line" }}>
                  {p}
                </p>
                <button type="button" className="jp-learn-btn" onClick={() => playParagraph(i)}>
                  Play words {i + 1}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-gate mt-3"
              onClick={() => {
                setPhase("comprehension");
                setCompIndex(0);
                setTyped("");
              }}
            >
              Start vocab quiz ({payload.story.comprehension.length} questions)
            </button>
          </>
        ) : null}

        {phase === "comprehension" && currentComp ? (
          <>
            <div className="jp-learn-meta">
              Comprehension {compIndex + 1} / {payload.story.comprehension.length}
            </div>
            <p className="jp-learn-prompt-en" style={{ fontSize: "1.4rem" }}>
              {currentComp.prompt}
            </p>
            <p className="jp-learn-sub">Type your answer in English.</p>
            <input
              className="jp-learn-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveCompAnswer()}
              disabled={pending}
              autoFocus
            />
            <div className="jp-learn-row mt-3">
              <button type="button" className="jp-learn-btn jp-learn-btn-gate" onClick={saveCompAnswer} disabled={pending}>
                {compIndex + 1 >= payload.story.comprehension.length ? "Continue to production" : "Next question"}
              </button>
            </div>
          </>
        ) : null}

        {phase === "production" && currentProd ? (
          <>
            <div className="jp-learn-meta">
              Production {prodIndex + 1} / {payload.story.production.length}
            </div>
            <p className="jp-learn-prompt-en">{currentProd.promptEnglish}</p>
            <p className="jp-learn-sub">Type the Japanese word in romaji.</p>
            <input
              className="jp-learn-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveProdAnswer()}
              disabled={pending}
              autoFocus
            />
            <div className="jp-learn-row mt-3">
              <button type="button" className="jp-learn-btn jp-learn-btn-gate" onClick={saveProdAnswer} disabled={pending}>
                {prodIndex + 1 >= payload.story.production.length ? "Submit checkpoint" : "Next word"}
              </button>
            </div>
          </>
        ) : null}

        {phase === "results" && result ? (
          <>
            <h2 className="jp-learn-big">{result.passed ? "Checkpoint passed" : "Not quite yet"}</h2>
            <p className="jp-learn-sub">
              Comprehension: {result.comprehensionScore}% · Production: {result.productionScore}% · Combined:{" "}
              {result.combinedScore}% (need {result.threshold}%)
            </p>
            {result.passed ? (
              <p className="jp-learn-status">Block {result.unlocksBlock} is now unlocked.</p>
            ) : (
              <>
                <p className="jp-learn-status">Review the words and try again.</p>
                {payload.story.comprehension.some((q) => result.comprehensionFeedback[q.id]?.correct === false) ? (
                  <div className="mt-3">
                    <p className="jp-learn-meta">Comprehension misses</p>
                    <ul className="jp-learn-sub" style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
                      {payload.story.comprehension
                        .filter((q) => result.comprehensionFeedback[q.id]?.correct === false)
                        .map((q) => {
                          const fb = result.comprehensionFeedback[q.id];
                          return (
                            <li key={q.id} style={{ marginBottom: "0.5rem" }}>
                              <strong>{q.prompt}</strong>
                              <br />
                              You said: {fb?.userAnswer || "(blank)"} · Accepted: {fb?.accepted || q.answer}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ) : null}
                {payload.story.production.some((q) => result.productionFeedback[q.id]?.correct === false) ? (
                  <div className="mt-3">
                    <p className="jp-learn-meta">Production misses</p>
                    <ul className="jp-learn-sub" style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
                      {payload.story.production
                        .filter((q) => result.productionFeedback[q.id]?.correct === false)
                        .map((q) => {
                          const fb = result.productionFeedback[q.id];
                          return (
                            <li key={q.id} style={{ marginBottom: "0.5rem" }}>
                              <strong>{q.promptEnglish}</strong>
                              <br />
                              You said: {fb?.userAnswer || "(blank)"} · Accepted: {fb?.accepted || q.targetRomaji}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
            <div className="jp-learn-row mt-3">
              {!result.passed ? (
                <button
                  type="button"
                  className="jp-learn-btn jp-learn-btn-gate"
                  onClick={() => {
                    setPhase("story");
                    setCompIndex(0);
                    setProdIndex(0);
                    setCompAnswers({});
                    setProdAnswers({});
                    setTyped("");
                    setResult(null);
                  }}
                >
                  Retry checkpoint
                </button>
              ) : null}
              {onClose ? (
                <button type="button" className="jp-learn-btn" onClick={onClose}>
                  Continue training
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {status ? <p className="jp-learn-status">{status}</p> : null}
      </div>
    </div>
  );
}
