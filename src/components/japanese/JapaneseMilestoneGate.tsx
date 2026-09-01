"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { JAPANESE_MILESTONE_PASS_THRESHOLD } from "@/lib/japanese/config";
import { cancelJapaneseSpeech, speakJapanese } from "@/lib/japanese/tts";
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
    loadMilestoneGate(milestoneNumber).then((data) => {
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
        });
      }
      setLoading(false);
    });
    return () => cancelJapaneseSpeech();
  }, [milestoneNumber]);

  const playParagraph = useCallback((text: string) => {
    speakJapanese(text);
  }, []);

  const playAll = useCallback(() => {
    if (!payload) return;
    let i = 0;
    const playNext = () => {
      if (i >= payload.story.paragraphs.length) return;
      const text = payload.story.paragraphs[i];
      i += 1;
      speakJapanese(text);
      setTimeout(playNext, Math.max(2500, text.length * 120));
    };
    playNext();
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
    return <p className="text-muted">Preparing your story checkpoint…</p>;
  }

  if (!payload) {
    return <p className="text-muted">{status || "Could not load checkpoint."}</p>;
  }

  return (
    <div className="jp-learn-wrap jp-learn-gate-wrap">
      <header className="jp-learn-header jp-learn-gate-header">
        <div className="jp-learn-meta">Story checkpoint</div>
        <h1 className="jp-learn-title">{payload.story.title}</h1>
        <p className="jp-learn-sub">
          {payload.label} vocabulary · Pass at {JAPANESE_MILESTONE_PASS_THRESHOLD}% to unlock Block{" "}
          {payload.unlocksBlock}
          {payload.story.provider ? ` · Generated via ${payload.story.provider}` : ""}
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
            <p className="jp-learn-sub">Listen to or read the story, then answer comprehension and production questions.</p>
            <div className="jp-learn-row mt-3">
              <button type="button" className="jp-learn-btn jp-learn-btn-gate" onClick={playAll}>
                Play full story
              </button>
            </div>
            {payload.story.paragraphs.map((p, i) => (
              <div key={i} style={{ marginTop: "1rem" }}>
                <p className="jp-learn-jp" style={{ lineHeight: 1.6 }}>
                  {p}
                </p>
                <button type="button" className="jp-learn-btn" onClick={() => playParagraph(p)}>
                  Play paragraph {i + 1}
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
              Start comprehension ({payload.story.comprehension.length} questions)
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
              <p className="jp-learn-status">Review the story and try again.</p>
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