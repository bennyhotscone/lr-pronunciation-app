"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ParticleSentenceBuilder } from "@/components/japanese/ParticleSentenceBuilder";
import {
  playCorrectAnswerSound,
  playIncorrectAnswerSound,
} from "@/lib/correct-answer-sound";
import {
  loadAllParticleMastery,
  loadParticleProgress,
  saveParticleProgress,
} from "@/lib/japanese-particle-actions";
import {
  PARTICLE_ROUND_LABELS,
  PARTICLE_ROUND_ORDER,
  buildTiles,
  createInitialParticleMeta,
  createInitialParticleSession,
  formRomajiChoices,
  formatVerbFormLabel,
  getEffectiveRound,
  isVerbLesson,
  mcChoices,
  normalizeParticleText,
  markRoundCompleted,
  questionJapaneseAudio,
  updateMetaAfterRound,

} from "@/lib/japanese/particles/engine";
import {
  getAllParticleLessons,
  getParticleLesson,
  PARTICLE_LESSON_ORDER,
  VERB_LESSON_ID,
} from "@/lib/japanese/particles/lessons";
import { acceptedEnglish, matchParticleRomaji } from "@/lib/japanese/particles/matching";
import type {
  ParticleBlockMeta,
  ParticleLesson,
  ParticleQuestion,
  ParticleRoundId,
  ParticleSessionState,
} from "@/lib/japanese/particles/types";
import {
  isParticleLessonAccessible,
  isParticleRoundAccessible,
} from "@/lib/japanese/particles/unlock";
import { PARTICLE_VERBS } from "@/lib/japanese/particles/verbs";
import { VerbEndingMnemonicCard } from "@/components/japanese/VerbEndingMnemonicCard";
import {
  formatEndingMnemonicLine,
  getVerbGroupForFamily,
  VERB_GROUP_LIST,
} from "@/lib/japanese/particles/mnemonics";
import { formatResolvedEndingMnemonicLine } from "@/lib/japanese/particles/mnemonic-storage";
import { playParticleAudio } from "@/lib/japanese/particles/audio";
import "./japanese-learning.css";

export function ParticleRoundApp() {
  const lessons = useMemo(() => getAllParticleLessons(), []);
  const [lessonId, setLessonId] = useState<string>(lessons[0]?.id ?? VERB_LESSON_ID);
  const lesson = useMemo(() => getParticleLesson(lessonId) ?? lessons[0], [lessonId, lessons]);
  const [session, setSession] = useState<ParticleSessionState | null>(null);
  const [meta, setMeta] = useState<ParticleBlockMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [block3Mastered, setBlock3Mastered] = useState(false);
  const [masteredByLesson, setMasteredByLesson] = useState<Record<string, boolean>>({});
  const [maxUnlockedBlock, setMaxUnlockedBlock] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveRound = getEffectiveRound(lesson.id, session?.round ?? "teach");
  const questions = lesson.questions;
  const current = questions[session?.questionIndex ?? 0];
  const questionKey = `${session?.round ?? "teach"}-${session?.questionIndex ?? 0}`;
  const shuffledVerbChoices = useMemo(() => {
    const q = lesson.questions[session?.questionIndex ?? 0];
    if (!q) return [];
    return mcChoices(q, lesson.questions, "verb");
  }, [questionKey, lessonId]);
  const shuffledBuildTiles = useMemo(() => {
    const q = lesson.questions[session?.questionIndex ?? 0];
    if (!q) return [];
    return buildTiles(lesson, q);
  }, [questionKey, lessonId]);
  const shuffledFormChoices = useMemo(() => {
    const q = lesson.questions[session?.questionIndex ?? 0];
    if (!q) return [];
    return formRomajiChoices(q, lesson.questions, true);
  }, [questionKey, lessonId]);
  const roundTotal = effectiveRound === "teach" ? 1 : questions.length;

  const persist = useCallback(
    (nextSession: ParticleSessionState, nextMeta: ParticleBlockMeta) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveParticleProgress(lessonId, nextSession, nextMeta);
      }, 400);
    },
    [lessonId],
  );

  useEffect(() => {
    void loadAllParticleMastery().then((data) => {
      if ("error" in data) return;
      setMasteredByLesson(data.masteredByLesson);
      setBlock3Mastered(data.block3Mastered);
      if (data.block3Mastered) setMaxUnlockedBlock(10);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    loadParticleProgress(lessonId).then((data) => {
      if ("error" in data) {
        setSession(createInitialParticleSession());
        setMeta(createInitialParticleMeta());
        setLoading(false);
        return;
      }
      setSession(data.session);
      setMeta(data.meta);
      setLoading(false);
    });
  }, [lessonId]);

  useEffect(() => {
    setSelected([]);
    setLocked(false);
    setTypedAnswer("");
    setFeedback(null);
  }, [lessonId, session?.round, session?.questionIndex]);

  useEffect(() => {
    if (!session) return;
    const q = lesson.questions[session.questionIndex ?? 0];
    if (!q) return;
    if (effectiveRound === "formMC" || effectiveRound === "verbMC" || effectiveRound === "listenType") {
      const t = setTimeout(() => playParticleAudio(q), 250);
      return () => clearTimeout(t);
    }
  }, [session?.round, session?.questionIndex, effectiveRound, lessonId]);

  const lessonAccessible = isParticleLessonAccessible(
    lesson.id,
    block3Mastered,
    maxUnlockedBlock,
    masteredByLesson,
  );

  const resetRound = () => {
    if (!session || !meta) return;
    const next = { ...session, questionIndex: 0, score: 0 };
    setSession(next);
    setSelected([]);
    setLocked(false);
    setTypedAnswer("");
    setFeedback(null);
    persist(next, meta);
  };

  const finishRound = (nextSession: ParticleSessionState, nextMeta: ParticleBlockMeta) => {
    const updated = updateMetaAfterRound(
      nextMeta,
      lesson.id,
      session?.round ?? "teach",
      nextSession.score,
      questions.length,
    );
    setMeta(updated);
    setMasteredByLesson((prev) => ({ ...prev, [lesson.id]: updated.mastered }));
    persist(nextSession, updated);
  };

  const goNext = () => {
    if (!session || !meta) return;
    const nextIndex = session.questionIndex + 1;
    if (nextIndex >= questions.length) {
      finishRound(session, meta);
      setFeedback(`Round complete. Score ${session.score} / ${questions.length}`);
      setLocked(true);
      return;
    }
    const next = { ...session, questionIndex: nextIndex };
    setSession(next);
    persist(next, meta);
  };

  const handleCorrect = (question: ParticleQuestion) => {
    playCorrectAnswerSound();
    setTimeout(() => playParticleAudio(question), 120);
  };

  const handleRomajiChoice = (choiceRomaji: string, question: ParticleQuestion) => {
    if (!session || !meta || locked) return;
    const ok = matchParticleRomaji(choiceRomaji, question.romaji);
    setLocked(true);
    if (ok) { const next = { ...session, score: session.score + 1 }; setSession(next); handleCorrect(question); }
    else { playIncorrectAnswerSound(); }
    const hook =
      formatResolvedEndingMnemonicLine(question.ending, question.romaji) ??
      question.mnemonic ??
      formatEndingMnemonicLine(question.ending, question.romaji);
    if (ok) {
      setFeedback(hook ? `Correct — ${hook}` : "Correct");
    } else {
      setFeedback(hook ? `Answer: ${question.romaji} — ${hook}` : `Answer: ${question.romaji}`);
    }
  };
  const handleVerbChoice = (choiceKey: string, question: ParticleQuestion) => {
    if (!session || !meta || locked) return;
    const ok = normalizeParticleText(choiceKey) === normalizeParticleText(question.base ?? question.romaji);
    setLocked(true);
    if (ok) {
      const next = { ...session, score: session.score + 1 };
      setSession(next);
      handleCorrect(question);
    } else {
      playIncorrectAnswerSound();
    }
    const hook =
      formatResolvedEndingMnemonicLine(question.ending, question.romaji) ??
      question.mnemonic ??
      formatEndingMnemonicLine(question.ending, question.romaji);
    if (ok) {
      setFeedback(hook ? `Correct — ${hook}` : "Correct");
    } else {
      const answer = question.base ?? question.romaji;
      const meaning = question.verb ?? question.en;
      const base = `Answer: ${answer}${meaning ? ` — ${meaning}` : ""}`;
      setFeedback(hook ? `${base} — ${hook}` : base);
    }
  };

  const handleChoice = (choiceEn: string, question: ParticleQuestion) => {
    if (!session || !meta || locked) return;
    const ok = normalizeParticleText(choiceEn) === normalizeParticleText(question.en);
    setLocked(true);
    if (ok) {
      const next = { ...session, score: session.score + 1 };
      setSession(next);
      handleCorrect(question);
    } else {
      playIncorrectAnswerSound();
    }
    const hook =
      formatResolvedEndingMnemonicLine(question.ending, question.romaji) ??
      question.mnemonic ??
      formatEndingMnemonicLine(question.ending, question.romaji);
    if (ok) {
      setFeedback(hook ? `Correct — ${hook}` : "Correct");
    } else {
      setFeedback(hook ? `Answer: ${question.en} — ${hook}` : `Answer: ${question.en}`);
    }
  };

  const handleBuildCheck = () => {
    if (!session || !meta || !current || locked) return;
    const ok = normalizeParticleText(selected.join(" ")) === normalizeParticleText(current.romaji);
    setLocked(true);
    if (ok) {
      const next = { ...session, score: session.score + 1 };
      setSession(next);
      handleCorrect(current);
    } else {
      playIncorrectAnswerSound();
    }
    setFeedback(ok ? "Correct" : `Answer: ${isVerbLesson(lesson) ? formatVerbFormLabel(current) : current.romaji}`);
  };

  const handleTypedCheck = (mode: "english" | "romaji") => {
    if (!session || !meta || !current || locked) return;
    const ok =
      mode === "english"
        ? acceptedEnglish(current, typedAnswer)
        : matchParticleRomaji(typedAnswer, current.romaji);
    setLocked(true);
    if (ok) {
      const next = { ...session, score: session.score + 1 };
      setSession(next);
      handleCorrect(current);
    } else {
      playIncorrectAnswerSound();
    }
    setFeedback(
      ok
        ? "Correct"
        : mode === "english"
          ? `Target: ${current.en}`
          : `Answer: ${isVerbLesson(lesson) ? formatVerbFormLabel(current) : current.romaji}`,
    );
  };

  const teachVerbs = () => {
    if (!session || !meta) return;
    const verb = PARTICLE_VERBS[session.verbTabIndex];
    return (
      <div className="jp-learn-card">
        <div className="jp-learn-meta">MAIN VERB ENDINGS</div>
        <h2 className="jp-learn-title" style={{ fontSize: "1.8rem" }}>One verb, many useful meanings</h2>
        <p className="jp-learn-sub">
          Notice what stays similar and what changes at the end. Hear the forms mixed until the meanings become automatic.
        </p>
        <div className="jp-particle-group-panel">
          <div className="jp-learn-meta">Three verb patterns</div>
          <p className="jp-learn-sub" style={{ marginTop: "0.35rem" }}>
            Forget textbook labels. You only need these three spoken patterns.
          </p>
          <div className="jp-particle-group-grid">
            {VERB_GROUP_LIST.map((g) => (
              <div key={g.id} className="jp-particle-group-card">
                <strong>{g.title}</strong>
                <p>{g.explain}</p>
                <div className="jp-particle-group-hook">Hook: {g.mnemonic}</div>
                <div className="jp-learn-sub">e.g. {g.examples.join(", ")}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="jp-particle-pattern-intro">
          <strong>Example:</strong>{" "}
          <span className="jp-particle-form-label">taberu — eat</span>
          {" · "}
          <span className="jp-particle-form-label">taberu → tabenai — don&apos;t eat</span>
        </div>
        <div className="jp-particle-verb-tabs">
          {PARTICLE_VERBS.map((v, i) => (
            <button
              key={v.base}
              type="button"
              className={`jp-particle-verb-tab ${i === session.verbTabIndex ? "jp-particle-verb-tab-active" : ""}`}
              onClick={() => setSession({ ...session, verbTabIndex: i })}
            >
              {v.base} = {v.meaning}
            </button>
          ))}
        </div>
        <div className="jp-particle-transform-box">
          {(() => {
            const group = getVerbGroupForFamily(verb.family);
            return group ? (
              <div className="jp-particle-verb-group-banner">
                <div className="jp-learn-meta">{group.title}</div>
                <p className="jp-learn-sub">{group.explain}</p>
                <div className="jp-particle-group-hook">Pattern hook: {group.mnemonic}</div>
              </div>
            ) : (
              <div className="jp-learn-meta">{verb.family}</div>
            );
          })()}
          <div className="jp-learn-big">{verb.base} <span className="jp-learn-sub">= {verb.meaning}</span></div>
          <div className="jp-particle-ending-guide">
            <div className="jp-learn-meta">Ending sound hooks</div>
            <p className="jp-learn-sub">
              Each ending has a plain-English job and 2–3 sound hooks. Pick the one that sticks — or write your own. Saved in this browser.
            </p>
          </div>
          <div className="jp-particle-forms">
            {verb.forms.map((form) => {
              return (
                <div key={form.romaji} className="jp-particle-form-row jp-particle-form-row-teach">
                  <div className="jp-particle-form-word">
                    <div className="jp-particle-form-label">{verb.base}{" -> "}{form.romaji}</div>
                    {form.stem && form.ending ? (
                      <div className="jp-particle-form-breakdown">
                        <span className="jp-particle-stem">{form.stem}</span>
                        <span className="jp-particle-ending">{form.ending}</span>
                      </div>
                    ) : null}
                    <div className="jp-particle-meaning">{form.meaning}</div>
                  </div>
                  <div className="jp-particle-meaning-cell">
                    <VerbEndingMnemonicCard ending={form.ending} romaji={form.romaji} compact />
                  </div>
                  <button type="button" className="jp-learn-btn" onClick={() => playParticleAudio({ jp: form.jp, romaji: form.romaji, en: form.meaning })}>
                    Play
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          className="jp-learn-btn jp-learn-btn-primary"
          style={{ marginTop: "1rem" }}
          onClick={() => {
            const next = { ...session, round: "formMC" as ParticleRoundId, questionIndex: 0, score: 0 };
            const nextMeta = markRoundCompleted(meta, "teach");
            setSession(next);
            setMeta(nextMeta);
            persist(next, nextMeta);
          }}
        >
          Start mixed audio recognition
        </button>
      </div>
    );
  };

  const teachParticle = (l: ParticleLesson) => (
    <div className="jp-learn-card">
      <h2 className="jp-learn-title" style={{ fontSize: "1.8rem" }}>{l.title}</h2>
      <p className="jp-learn-sub">{l.subtitle}</p>
      <div className="jp-particle-rule">{l.rule}</div>
      <p className="jp-learn-sub">{l.explain}</p>
      <div className="jp-particle-forms">
        {l.examples.map((ex) => (
          <div key={ex.romaji} className="jp-particle-form-row">
            <div className="jp-particle-form-word">{ex.romaji}</div>
            <div className="jp-particle-meaning">{ex.en}</div>
            <button type="button" className="jp-learn-btn" onClick={() => playParticleAudio({ jp: ex.jp, romaji: ex.romaji, en: ex.en })}>
              Play
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="jp-learn-btn jp-learn-btn-primary"
        style={{ marginTop: "1rem" }}
        onClick={() => {
          if (!session || !meta) return;
          const next = { ...session, round: "build" as ParticleRoundId, questionIndex: 0, score: 0 };
          const nextMeta = markRoundCompleted(meta, "teach");
          setSession(next);
          setMeta(nextMeta);
          persist(next, nextMeta);
        }}
      >
        Practice
      </button>
    </div>
  );

  const renderRound = () => {
    if (!session || !meta || !current) return null;

    if (effectiveRound === "teach") {
      return isVerbLesson(lesson) ? teachVerbs() : teachParticle(lesson);
    }

    if (effectiveRound === "formMC") {
      const choices = shuffledFormChoices;
      const hasAudio = !!questionJapaneseAudio(current);
      return (
        <div className="jp-learn-card">
          <div className="jp-learn-meta">Same verb, different endings</div>
          {locked ? (
            <>
              {current.jp ? <div className="jp-learn-jp">{current.jp}</div> : null}
              <div className="jp-particle-form-label jp-learn-romaji-xl">{formatVerbFormLabel(current)}</div>
            </>
          ) : (
            <div className="jp-particle-form-audio-prompt"><div className="jp-learn-big">{current.base}</div><div className="jp-learn-sub">— {current.verb ?? current.base}</div></div>
          )}
          <button type="button" className="jp-learn-btn jp-learn-btn-primary" disabled={!hasAudio} onClick={() => playParticleAudio(current)}>Play</button>
          <p className="jp-learn-sub" style={{ marginTop: "0.75rem" }}>
            {locked
              ? "Full form shown above (tabenai, not shoku from the kanji)."
              : "Listen for a form of " + current.base + ", then pick matching romaji and meaning."}
          </p>
          <VerbEndingMnemonicCard
            ending={current.ending}
            romaji={current.romaji}
            defaultOpen
            className="jp-learn-mnemonic jp-particle-ending-mnemonic-card"
          />
          <div className="jp-learn-choices">
            {choices.map((choice) => (
              <button
                key={choice.romaji}
                type="button"
                className="jp-learn-btn jp-learn-choice jp-particle-romaji-choice"
                disabled={locked}
                onClick={() => handleRomajiChoice(choice.romaji, current)}
              >
                <span className="jp-particle-romaji-choice-main">{current.base}{" -> "}{choice.romaji}</span>
                <span className="jp-particle-romaji-choice-jp">{choice.en}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (effectiveRound === "verbMC") {
      const choices = shuffledVerbChoices;
      const hasAudio = !!questionJapaneseAudio(current);
      return (
        <div className="jp-learn-card">
          <div className="jp-learn-meta">Different verbs, same ending</div>
          {current.ending ? (
            <div className="jp-learn-sub" style={{ marginTop: "0.5rem" }}>
              Same ending: <strong>{current.ending}</strong>
            </div>
          ) : null}
          <button type="button" className="jp-learn-btn jp-learn-btn-primary" disabled={!hasAudio} onClick={() => playParticleAudio(current)}>Play Japanese</button>
          <div className="jp-learn-prompt-en">Which verb did you hear?</div>
          <VerbEndingMnemonicCard
            ending={current.ending}
            romaji={current.romaji}
            defaultOpen
            className="jp-learn-mnemonic jp-particle-ending-mnemonic-card"
          />
          <div className="jp-learn-choices">
            {choices.map((choice) => (
              <button
                key={choice.key}
                type="button"
                className="jp-learn-btn jp-learn-choice jp-particle-romaji-choice"
                disabled={locked}
                onClick={() => handleVerbChoice(choice.key, current)}
              >
                <span className="jp-particle-romaji-choice-main">{choice.base}{" -> "}{choice.romaji}</span>
                <span className="jp-particle-romaji-choice-jp">{choice.en}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (effectiveRound === "build") {
      const tiles = shuffledBuildTiles;
      return (
        <div className="jp-learn-card">
          <div className="jp-learn-meta">{lesson.title}</div>
          <div className="jp-learn-prompt-en">{current.en}</div>
          <ParticleSentenceBuilder
            instruction={
              isVerbLesson(lesson)
                ? "Choose the Japanese form that carries this meaning."
                : "Tap the words in order to build the conversational Japanese."
            }
            tiles={tiles}
            selected={selected}
            locked={locked}
            singleSelect={isVerbLesson(lesson)}
            onSelectedChange={setSelected}
            onClear={() => setSelected([])}
            onCheck={handleBuildCheck}
          />
        </div>
      );
    }

    if (effectiveRound === "listenType") {
      return (
        <div className="jp-learn-card">
          <div className="jp-learn-meta">{lesson.title}</div>
          <button type="button" className="jp-learn-btn jp-learn-btn-primary" onClick={() => playParticleAudio(current)}>
            Play Japanese
          </button>
          <div className="jp-learn-prompt-en">Type the English meaning</div>
          <input
            className="jp-learn-input"
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="jp-learn-btn jp-learn-btn-primary"
            style={{ marginTop: "0.75rem" }}
            disabled={locked}
            onClick={() => handleTypedCheck("english")}
          >
            Check
          </button>
        </div>
      );
    }

    return (
      <div className="jp-learn-card">
        <div className="jp-learn-meta">{lesson.title}</div>
        <div className="jp-learn-prompt-en">{current.en}</div>
        <p className="jp-learn-sub">Type the Japanese in romaji.</p>
        <input
          className="jp-learn-input"
          value={typedAnswer}
          onChange={(e) => setTypedAnswer(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button
          type="button"
          className="jp-learn-btn jp-learn-btn-primary"
          style={{ marginTop: "0.75rem" }}
          disabled={locked}
          onClick={() => handleTypedCheck("romaji")}
        >
          Check
        </button>
      </div>
    );
  };

  const progressPct =
    effectiveRound === "teach"
      ? 0
      : Math.min(100, Math.round(((session?.questionIndex ?? 0) / roundTotal) * 100));

  return (
    <div className="jp-learn-wrap">
      <header className="jp-learn-header">
        <div className="jp-learn-meta">LRMASTERY / MAKE SENTENCES</div>
        <h1 className="jp-learn-title">Make Sentences</h1>
        <p className="jp-learn-sub">
          Use words you already know. Build short spoken Japanese without auto-inserting watashi wa.
        </p>
        <div className="jp-learn-row" style={{ marginTop: "0.75rem" }}>
          <Link href="/portal/learn-japanese" className="jp-learn-btn">Back to Learn Japanese</Link>
        </div>
      </header>

      {!lessonAccessible && (
        <div className="jp-learn-gate-banner" role="status">
          Complete Block 3 vocabulary (or the previous particle lesson) to unlock this practice.
        </div>
      )}

      <div className="jp-particle-controls">
        <select
          className="jp-particle-select"
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
          aria-label="Lesson"
        >
          {lessons.map((l) => (
            <option key={l.id} value={l.id} disabled={!isParticleLessonAccessible(l.id, block3Mastered, maxUnlockedBlock, masteredByLesson)}>
              {l.title}
            </option>
          ))}
        </select>
        <select
          className="jp-particle-select"
          value={session?.round ?? "teach"}
          onChange={(e) => {
            if (!session || !meta) return;
            const round = e.target.value as ParticleRoundId;
            if (!isParticleRoundAccessible(round, meta, lesson.id, block3Mastered, maxUnlockedBlock)) return;
            const next = { ...session, round, questionIndex: 0, score: 0 };
            setSession(next);
            persist(next, meta);
          }}
          aria-label="Round"
        >
          {PARTICLE_ROUND_ORDER.map((round) => (
            <option
              key={round}
              value={round}
              disabled={
                !isParticleRoundAccessible(round, meta ?? createInitialParticleMeta(), lesson.id, block3Mastered, maxUnlockedBlock)
              }
            >
              {PARTICLE_ROUND_LABELS[round]}
            </option>
          ))}
        </select>
        <button type="button" className="jp-learn-btn" onClick={resetRound} disabled={pending}>
          Restart round
        </button>
      </div>

      <div className="jp-learn-progress" aria-hidden="true">
        <div style={{ width: `${progressPct}%`, height: "100%", background: "#222" }} />
      </div>
      <div className="jp-learn-row" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <span className="jp-learn-meta">
          {effectiveRound === "teach"
            ? "Teaching patterns"
            : `${Math.min((session?.questionIndex ?? 0) + 1, roundTotal)} / ${roundTotal}`}
        </span>
        <span className="jp-learn-meta">
          {effectiveRound === "teach" ? "" : `Score ${session?.score ?? 0}`}
        </span>
      </div>

      {loading ? <div className="jp-learn-card">Loading...</div> : renderRound()}

      {feedback && (
        <div
          className={`jp-particle-feedback ${feedback.startsWith("Correct") || feedback.startsWith("Round") ? "jp-particle-feedback-good" : "jp-particle-feedback-bad"}`}
        >
          <strong>{feedback}</strong>
          {locked && feedback !== `Round complete. Score ${session?.score ?? 0} / ${questions.length}` && (
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-primary"
              style={{ marginTop: "0.75rem" }}
              onClick={goNext}
            >
              Next
            </button>
          )}
          {feedback.startsWith("Round complete") && (
            <button
              type="button"
              className="jp-learn-btn jp-learn-btn-primary"
              style={{ marginTop: "0.75rem" }}
              onClick={resetRound}
            >
              Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}