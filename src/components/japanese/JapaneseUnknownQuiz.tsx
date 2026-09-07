"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ParticleSentenceBuilder } from "@/components/japanese/ParticleSentenceBuilder";
import { JapaneseKnowCheckbox } from "@/components/japanese/JapaneseKnowCheckbox";
import { JapaneseMnemonicHook } from "@/components/japanese/JapaneseMnemonicHook";
import { speakJapanese } from "@/lib/japanese/tts";
import {
  formatPreferredRomaji,
  matchAcceptedSentenceAnswers,
} from "@/lib/japanese/revision-sentence-match";
import { fuzzyMatchEnglish, fuzzyMatchRomaji } from "@/lib/japanese/matching";
import { markJapaneseWordKnown } from "@/lib/japanese-actions";
import {
  loadUnknownPracticeQuiz,
  type UnknownPracticePayload,
} from "@/lib/japanese-unknown-quiz-actions";
import type {
  RevisionQuestion,
  RevisionSentenceQuestion,
  RevisionWordQuestion,
} from "@/lib/japanese/revision-quiz-build";
import {
  playCorrectAnswerSound,
  playIncorrectAnswerSound,
} from "@/lib/correct-answer-sound";
import "./japanese-learning.css";

type Props = {
  onClose: () => void;
};

function isWordQuestion(q: RevisionQuestion): q is RevisionWordQuestion {
  return q.kind === "word";
}

function isSentenceQuestion(q: RevisionQuestion): q is RevisionSentenceQuestion {
  return q.kind === "sentence";
}

export function JapaneseUnknownQuiz({ onClose }: Props) {
  const [payload, setPayload] = useState<UnknownPracticePayload | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [selectedTiles, setSelectedTiles] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mnemonicRevealed, setMnemonicRevealed] = useState(false);
  const [knownMarks, setKnownMarks] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    yourAnswer?: string;
    natural?: string;
  } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setDone(false);
    setQIndex(0);
    setTyped("");
    setSelectedTiles([]);
    setFeedback(null);
    setKnownMarks({});
    setStatus("");
    startTransition(async () => {
      const data = await loadUnknownPracticeQuiz();
      if ("error" in data) {
        setStatus(data.error);
        setPayload(null);
        setLoading(false);
        return;
      }
      setPayload(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = payload?.questions[qIndex];
  const isSentence = current ? isSentenceQuestion(current) : false;

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
    setMnemonicRevealed(false);
  }, [qIndex]);

  const updateMnemonic = (wordIndex: number, value: string | null) => {
    if (!payload || !current || !isWordQuestion(current)) return;
    if (current.wordIndex !== wordIndex) return;
    const canonical = current.canonicalMnemonic || current.mnemonic;
    const display = value?.trim() || canonical;
    setPayload({
      ...payload,
      questions: payload.questions.map((q) =>
        q.kind === "word" &&
        q.blockNumber === current.blockNumber &&
        q.wordIndex === current.wordIndex
          ? { ...q, canonicalMnemonic: q.canonicalMnemonic || canonical, mnemonic: display }
          : q,
      ),
    });
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
    setFeedback({
      correct: ok,
      yourAnswer: ok ? undefined : typed.trim(),
    });
    setMnemonicRevealed(true);
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
    setFeedback({
      correct: true,
      natural: match.caveman ? natural : undefined,
    });
    setStatus("");
  };

  const advance = () => {
    if (!payload) return;
    const next = qIndex + 1;
    if (next >= payload.questions.length) {
      setDone(true);
      return;
    }
    setFeedback(null);
    setQIndex(next);
  };

  if (loading) {
    return <p className="text-muted">Loading unknown-word practice…</p>;
  }

  if (!payload) {
    return (
      <div className="jp-learn-wrap">
        <p className="text-muted">{status || "Nothing to practice."}</p>
        <button type="button" className="jp-learn-btn mt-3" onClick={onClose}>
          Back
        </button>
      </div>
    );
  }

  if (done) {
    const markedKnown = Object.values(knownMarks).filter(Boolean).length;
    return (
      <div className="jp-learn-wrap">
        <header className="jp-learn-header">
          <h1 className="jp-learn-title">Unknown practice done</h1>
          <p className="jp-learn-meta">
            Reviewed {payload.wordCount} words
            {payload.unknownTotal > payload.wordCount
              ? ` (of ${payload.unknownTotal} unknowns)`
              : ""}
            {markedKnown ? ` · marked ${markedKnown} known` : ""}
          </p>
        </header>
        <section className="jp-learn-card">
          <button type="button" className="jp-learn-btn jp-learn-btn-primary" onClick={load}>
            Practice again
          </button>
          <button type="button" className="jp-learn-btn mt-3" onClick={onClose}>
            Back to training
          </button>
        </section>
      </div>
    );
  }

  if (!current) return null;

  const showReveal =
    isWordQuestion(current) && !feedback && !mnemonicRevealed;
  const showMnemonic =
    isWordQuestion(current) && (feedback || mnemonicRevealed);

  const overrideVal = (q: RevisionWordQuestion) => {
    const canonical = (q.canonicalMnemonic || q.mnemonic).trim();
    const effective = q.mnemonic.trim();
    return effective && effective !== canonical ? effective : null;
  };

  return (
    <div className="jp-learn-wrap">
      <header className="jp-learn-header">
        <h1 className="jp-learn-title">Practice unknowns</h1>
        <p className="jp-learn-meta">
          Question {qIndex + 1} of {payload.questions.length} · {payload.wordCount} words
          {payload.unknownTotal > payload.wordCount
            ? ` (sample of ${payload.unknownTotal})`
            : ""}
        </p>
        <p className="jp-learn-sub">
          Audio → meaning / English → romaji. Sentence builders appear when five unknowns match a
          curated batch. Mark “I know this” or “I need to practice this” after each word.
        </p>
      </header>
      <section className="jp-learn-card">
        <div className="jp-learn-progress">
          <div
            style={{
              width: `${((qIndex + 1) / payload.questions.length) * 100}%`,
            }}
          />
        </div>

        {isSentence && isSentenceQuestion(current) ? (
          <>
            <div className="jp-learn-big">SENTENCE — use these unknowns</div>
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

            {showReveal ? (
              <button
                type="button"
                className="jp-learn-btn mt-2"
                onClick={() => setMnemonicRevealed(true)}
              >
                Reveal mnemonic
              </button>
            ) : null}

            {showMnemonic && !feedback ? (
              <JapaneseMnemonicHook
                blockNumber={current.blockNumber}
                wordIndex={current.wordIndex}
                canonicalMnemonic={current.canonicalMnemonic || current.mnemonic}
                mnemonic={overrideVal(current)}
                onMnemonicChange={updateMnemonic}
                className="jp-learn-mnemonic mt-2"
              />
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
                <div
                  className={
                    feedback.correct
                      ? "jp-mnemonic-feedback jp-mnemonic-feedback-ok"
                      : "jp-mnemonic-feedback jp-mnemonic-feedback-bad"
                  }
                >
                  {feedback.correct ? (
                    <>
                      <div>✓ {current.romaji}</div>
                      <div>{current.english}</div>
                    </>
                  ) : (
                    <>
                      <div>✗ Your answer: {feedback.yourAnswer}</div>
                      <div>Correct: {current.romaji}</div>
                      <div>{current.english}</div>
                    </>
                  )}
                  <JapaneseMnemonicHook
                    blockNumber={current.blockNumber}
                    wordIndex={current.wordIndex}
                    canonicalMnemonic={current.canonicalMnemonic || current.mnemonic}
                    mnemonic={overrideVal(current)}
                    onMnemonicChange={updateMnemonic}
                    autoEdit={!feedback.correct}
                    className="jp-learn-mnemonic mt-2"
                  />
                  <JapaneseKnowCheckbox
                    id={`jp-unk-know-${current.id}`}
                    checked={knownMarks[current.wordId] ?? null}
                    onChange={(known) => {
                      setKnownMarks((prev) => ({ ...prev, [current.wordId]: known }));
                      void markJapaneseWordKnown(
                        current.blockNumber,
                        current.wordIndex,
                        known,
                      );
                    }}
                  />
                </div>
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
              onClick={advance}
            >
              {qIndex + 1 >= payload.questions.length ? "Finish" : "Continue"}
            </button>
          ) : null}
          <button type="button" className="jp-learn-btn" onClick={onClose} disabled={pending}>
            Exit
          </button>
        </div>
      </section>
    </div>
  );
}
