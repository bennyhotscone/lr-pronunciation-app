"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  advanceGuided,
  advanceRecall,
  checkGuidedAnswer,
  completeTeachPhase,
  createInitialGrammarMeta,
  createInitialGrammarSession,
  getRecallQuestions,
  updateGrammarMetaAfterComplete,
} from "@/lib/japanese/grammar/engine";
import { getAllGrammarBlocks, getGrammarBlock } from "@/lib/japanese/grammar";
import {
  matchGrammarEnglish,
  matchGrammarRomaji,
  matchGrammarReorder,
} from "@/lib/japanese/grammar/matching";
import type { GrammarBlockMeta, GrammarSessionState } from "@/lib/japanese/grammar/types";
import { speakJapanese } from "@/lib/japanese/tts";
import {
  loadGrammarProgress,
  resetGrammarBlockProgress,
  saveGrammarProgress,
} from "@/lib/japanese-grammar-actions";
import "../japanese/japanese-learning.css";

export function GrammarLearningApp() {
  const blocks = useMemo(() => getAllGrammarBlocks(), []);
  const [blockId, setBlockId] = useState(blocks[0]?.id ?? "direction-ni");
  const block = useMemo(() => getGrammarBlock(blockId), [blockId]);
  const [session, setSession] = useState<GrammarSessionState | null>(null);
  const [meta, setMeta] = useState<GrammarBlockMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [selectedMc, setSelectedMc] = useState<number | null>(null);
  const [reorderWords, setReorderWords] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [answered, setAnswered] = useState(false);
  const [pending, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!block) return;
    setLoading(true);
    loadGrammarProgress(blockId).then((data) => {
      if ("error" in data) {
        setLoading(false);
        return;
      }
      setSession(data.session);
      setMeta(data.meta);
      setLoading(false);
    });
  }, [blockId, block]);

  const persist = useCallback(
    (nextSession: GrammarSessionState, nextMeta: GrammarBlockMeta) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveGrammarProgress(blockId, nextSession, nextMeta);
      }, 400);
    },
    [blockId],
  );

  const recallList = useMemo(() => {
    if (!block || !session) return [];
    return getRecallQuestions(block, session.recallMode);
  }, [block, session]);

  const currentRecall = recallList[session?.recallIndex ?? 0];

  useEffect(() => {
    if (!session || session.phase !== "guided" || !block) return;
    const q = block.guided[session.guidedIndex];
    if (q?.kind === "reorder") setReorderWords([...q.words]);
    else setReorderWords([]);
    setTypedAnswer("");
    setSelectedMc(null);
    setAnswered(false);
    setStatus("");
  }, [session?.guidedIndex, session?.phase, block, session]);

  useEffect(() => {
    if (!session || session.phase !== "recall" || !currentRecall) return;
    setTypedAnswer("");
    setAnswered(false);
    setStatus("");
    if (currentRecall.audio) {
      const t = setTimeout(() => speakJapanese(currentRecall.audio!), 300);
      return () => clearTimeout(t);
    }
  }, [session?.recallIndex, session?.recallMode, session?.phase, currentRecall]);

  const handleStartGuided = () => {
    if (!session || !meta) return;
    const next = completeTeachPhase(session);
    const nextMeta = { ...meta, teachCompleted: true };
    setSession(next);
    setMeta(nextMeta);
    persist(next, nextMeta);
  };

  const handleGuidedSubmit = () => {
    if (!session || !meta || !block || answered) return;
    const q = block.guided[session.guidedIndex];
    if (!q) return;

    let correct = false;
    if (q.kind === "mc") {
      if (selectedMc === null) {
        setStatus("Pick an answer.");
        return;
      }
      correct = checkGuidedAnswer(q, "", selectedMc);
    } else if (q.kind === "fill") {
      correct = checkGuidedAnswer(q, typedAnswer);
    } else if (q.kind === "reorder" || q.kind === "build") {
      const answer = q.kind === "reorder" ? reorderWords.join(" ") : typedAnswer;
      correct = matchGrammarReorder(answer, q.answer);
    }

    setAnswered(true);
    setStatus(correct ? "Correct" : "Try again on the next pass");
    const next = advanceGuided(session, block.guided.length, correct, String(session.guidedIndex));
    let nextMeta = meta;
    if (next.phase === "recall") {
      nextMeta = { ...meta, guidedCompleted: true };
    }
    setSession(next);
    setMeta(nextMeta);
    persist(next, nextMeta);
  };

  const handleRecallSubmit = () => {
    if (!session || !meta || !block || !currentRecall || answered) return;
    if (!typedAnswer.trim()) {
      setStatus("Type an answer.");
      return;
    }

    const correct =
      currentRecall.direction === "j-to-e"
        ? matchGrammarEnglish(typedAnswer, currentRecall.answers)
        : matchGrammarRomaji(
            typedAnswer,
            currentRecall.romajiAnswers ?? currentRecall.answers,
          );

    setAnswered(true);
    setStatus(correct ? "Accepted" : `Answer: ${currentRecall.direction === "j-to-e" ? currentRecall.answers[0] : currentRecall.romajiAnswers?.[0]}`);

    const jCount = block.recall.filter((q) => q.direction === "j-to-e").length;
    const eCount = block.recall.filter((q) => q.direction === "e-to-j").length;
    const { session: next, phaseComplete } = advanceRecall(
      session,
      jCount,
      eCount,
      correct,
      currentRecall.id,
    );

    let nextMeta = meta;
    if (phaseComplete) {
      nextMeta = updateGrammarMetaAfterComplete(meta, blockId, true, true);
    }

    setSession(next);
    setMeta(nextMeta);
    persist(next, nextMeta);
  };

  const handleContinue = () => {
    if (!answered) return;
    setAnswered(false);
    setStatus("");
    setTypedAnswer("");
    setSelectedMc(null);
  };

  const handleReset = () => {
    if (!confirm("Reset grammar progress for this block?")) return;
    startTransition(async () => {
      await resetGrammarBlockProgress(blockId);
      const fresh = await loadGrammarProgress(blockId);
      if ("error" in fresh) return;
      setSession(fresh.session);
      setMeta(fresh.meta);
    });
  };

  if (loading || !session || !meta || !block) {
    return <p className="text-muted">Loading grammar course.</p>;
  }

  const guidedQ = block.guided[session.guidedIndex];
  const phaseLabel =
    session.phase === "teach"
      ? "Phase 1 — Teach me"
      : session.phase === "guided"
        ? "Phase 2 — Guided practice"
        : "Phase 3 — Active recall";

  return (
    <div className="jp-learn-wrap">
      <header className="jp-learn-header">
        <div className="jp-learn-meta">Japanese Grammar · {block.title}</div>
        <h1 className="jp-learn-title">{block.teach.title}</h1>
        {meta.mastered ? (
          <p className="jp-learn-meta mt-2">Block mastered</p>
        ) : null}
        <nav className="jp-learn-block-nav" aria-label="Grammar blocks">
          {blocks.map((b) => {
            const unlocked = meta.unlockedBlocks.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                className={b.id === blockId ? "jp-learn-btn jp-learn-btn-primary" : "jp-learn-btn"}
                disabled={!unlocked || pending}
                onClick={() => setBlockId(b.id)}
              >
                {b.title}
                {!unlocked ? " (locked)" : null}
              </button>
            );
          })}
        </nav>
      </header>

      <section className="jp-learn-card">
        <div className="jp-learn-meta">{phaseLabel}</div>

        {session.phase === "teach" ? (
          <>
            <p className="jp-learn-sub mt-2">{block.teach.summary}</p>
            {block.teach.sections.map((s) => (
              <div key={s.heading} className="mt-4">
                <h2 className="jp-learn-practice-title">{s.heading}</h2>
                <p className="jp-learn-sub">{s.body}</p>
              </div>
            ))}
            <h2 className="jp-learn-practice-title mt-4">Examples</h2>
            <ul className="jp-learn-sub space-y-3">
              {block.teach.examples.map((ex) => (
                <li key={ex.jp}>
                  <div className="jp-learn-jp">{ex.jp}</div>
                  <div className="jp-learn-romaji">{ex.romaji}</div>
                  <div className="jp-learn-english">{ex.en}</div>
                  <div className="jp-learn-meta">Breakdown: {ex.breakdown}</div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-primary mt-4"
              onClick={handleStartGuided}
            >
              Start guided practice
            </button>
          </>
        ) : null}

        {session.phase === "guided" && guidedQ ? (
          <>
            <div className="jp-learn-meta mt-2">
              Question {session.guidedIndex + 1} of {block.guided.length}
            </div>
            <div className="jp-learn-big mt-2">{guidedQ.prompt}</div>
            {guidedQ.hint ? <p className="jp-learn-sub">{guidedQ.hint}</p> : null}

            {guidedQ.kind === "mc" ? (
              <div className="jp-learn-choices mt-3">
                {guidedQ.choices.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    className={`jp-learn-btn jp-learn-choice ${selectedMc === i ? "jp-learn-choice-correct" : ""}`}
                    disabled={answered}
                    onClick={() => setSelectedMc(i)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}

            {guidedQ.kind === "fill" ? (
              <div className="jp-learn-row mt-3" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <span>{guidedQ.before}</span>
                <input
                  className="jp-learn-input"
                  style={{ width: "5rem" }}
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  disabled={answered}
                />
                <span>{guidedQ.after}</span>
              </div>
            ) : null}

            {guidedQ.kind === "reorder" ? (
              <div className="mt-3">
                <div className="jp-learn-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  {reorderWords.map((w, i) => (
                    <button
                      key={`${w}-${i}`}
                      type="button"
                      className="jp-learn-btn"
                      disabled={answered}
                      onClick={() => {
                        if (i === 0) return;
                        const next = [...reorderWords];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        setReorderWords(next);
                      }}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <p className="jp-learn-sub mt-2">Tap a word to move it left.</p>
              </div>
            ) : null}

            {guidedQ.kind === "build" ? (
              <>
                <div className="jp-learn-row mt-3" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  {guidedQ.bank.map((w) => (
                    <button
                      key={w}
                      type="button"
                      className="jp-learn-btn"
                      disabled={answered}
                      onClick={() => setTypedAnswer((t) => (t ? `${t} ${w}` : w))}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <input
                  className="jp-learn-input mt-2"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  disabled={answered}
                />
              </>
            ) : null}

            <div className="jp-learn-status">{status}</div>
            {!answered ? (
              <button
                type="button"
                className="jp-learn-btn jp-learn-btn-primary mt-3"
                onClick={handleGuidedSubmit}
              >
                Check
              </button>
            ) : (
              <button type="button" className="jp-learn-btn mt-3" onClick={handleContinue}>
                Continue
              </button>
            )}
          </>
        ) : null}

        {session.phase === "recall" && currentRecall ? (
          <>
            <div className="jp-learn-meta mt-2">
              {session.recallMode === "j-to-e" ? "Japanese → English" : "English → Japanese"} ·{" "}
              {session.recallIndex + 1} / {recallList.length}
            </div>

            {currentRecall.direction === "j-to-e" ? (
              <>
                {currentRecall.promptJp ? (
                  <div className="jp-learn-jp mt-2">{currentRecall.promptJp}</div>
                ) : null}
                <div className="jp-learn-romaji">{currentRecall.promptRomaji}</div>
                <button
                  type="button"
                  className="jp-learn-btn jp-learn-btn-primary mt-2"
                  onClick={() => currentRecall.audio && speakJapanese(currentRecall.audio)}
                >
                  Play audio
                </button>
                <input
                  className="jp-learn-input mt-3"
                  placeholder="Type the English meaning"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  disabled={answered}
                  onKeyDown={(e) => e.key === "Enter" && !answered && handleRecallSubmit()}
                />
              </>
            ) : (
              <>
                <div className="jp-learn-prompt-en mt-2">{currentRecall.promptEn}</div>
                <input
                  className="jp-learn-input mt-3"
                  placeholder="Type romaji, e.g. mise ni iku"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  disabled={answered}
                  onKeyDown={(e) => e.key === "Enter" && !answered && handleRecallSubmit()}
                />
              </>
            )}

            <div className="jp-learn-status">{status}</div>
            {!answered ? (
              <button
                type="button"
                className="jp-learn-btn jp-learn-btn-primary mt-3"
                onClick={handleRecallSubmit}
              >
                Check answer
              </button>
            ) : (
              <button type="button" className="jp-learn-btn mt-3" onClick={handleContinue}>
                Continue
              </button>
            )}
          </>
        ) : null}

        {session.phase === "recall" && !currentRecall && meta.mastered ? (
          <div className="mt-4">
            <div className="jp-learn-big">Pattern mastered</div>
            <p className="jp-learn-sub">
              You completed Japanese→English and English→Japanese recall for {block.title}.
            </p>
          </div>
        ) : null}
      </section>

      <footer className="jp-learn-footer">
        <button
          type="button"
          className="jp-learn-btn jp-learn-btn-danger"
          onClick={handleReset}
          disabled={pending}
        >
          Reset progress
        </button>
      </footer>
    </div>
  );
}
