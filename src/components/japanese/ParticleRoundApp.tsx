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
  getEffectiveRound,
  isVerbLesson,
  meaningChoices,
  normalizeParticleText,
  markRoundCompleted,
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
    if (!session || !current) return;
    if (effectiveRound === "formMC" || effectiveRound === "verbMC" || effectiveRound === "listenType") {
      const t = setTimeout(() => playParticleAudio(current), 250);
      return () => clearTimeout(t);
    }
  }, [session?.round, session?.questionIndex, effectiveRound, current]);

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
    setFeedback(ok ? "Correct" : `Answer: ${question.en}`);
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
    setFeedback(ok ? "Correct" : `Answer: ${current.romaji}`);
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
          : `Answer: ${current.romaji}`,
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
        <div className="jp-particle-pattern-intro">
          <strong>Example:</strong>
          <span className="jp-particle-stem">TABE</span>
          <span className="jp-particle-ending">ru</span>
          {" -> "}
          <span className="jp-particle-stem">TABE</span>
          <span className="jp-particle-ending">nai</span>
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
          <div className="jp-learn-meta">{verb.family}</div>
          <div className="jp-learn-big">{verb.base} <span className="jp-learn-sub">= {verb.meaning}</span></div>
          <div className="jp-particle-forms">
            {verb.forms.map((form) => (
              <div key={form.romaji} className="jp-particle-form-row">
                <div className="jp-particle-form-word">
                  <span className="jp-particle-stem">{form.stem}</span>
                  <span className="jp-particle-ending">{form.ending}</span>
                </div>
                <div className="jp-particle-meaning">{form.meaning}</div>
                <button type="button" className="jp-learn-btn" onClick={() => playParticleAudio({ jp: form.jp, romaji: form.romaji, en: form.meaning })}>
                  Play
                </button>
              </div>
            ))}
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

    if (effectiveRound === "formMC" || effectiveRound === "verbMC") {
      const choices = meaningChoices(
        current,
        questions,
        effectiveRound === "formMC",
      );
      return (
        <div className="jp-learn-card">
          <div className="jp-learn-meta">
            {effectiveRound === "formMC" ? "ONE VERB - MIXED FORMS" : "MANY VERBS - MIXED FORMS"}
          </div>
          <button type="button" className="jp-learn-btn jp-learn-btn-primary" onClick={() => playParticleAudio(current)}>
            Play Japanese
          </button>
          <div className="jp-learn-prompt-en">What does it mean?</div>
          <div className="jp-learn-choices">
            {choices.map((choice) => (
              <button
                key={choice}
                type="button"
                className="jp-learn-btn jp-learn-choice"
                disabled={locked}
                onClick={() => handleChoice(choice, current)}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (effectiveRound === "build") {
      const tiles = buildTiles(lesson, current);
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