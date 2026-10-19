"use client";

import { useState } from "react";
import { poolForKind } from "@/lib/lantite/generate";
import {
  BANK_NOTICE,
  DATA_NOTICE,
  DIFFICULTY_DETAILS,
  DIFFICULTY_LABELS,
  DISCLAIMER,
  FEEDBACK_LABELS,
  formatDuration,
  KIND_DETAILS,
  KIND_LABELS,
  PRACTICE_LIMIT_MS,
  TIMER_NOTICE,
} from "@/lib/lantite/labels";
import {
  DIFFICULTIES,
  QUESTION_COUNTS,
  TEST_KINDS,
  type Difficulty,
  type FeedbackMode,
  type InProgressAttempt,
  type QuestionCount,
  type TestKind,
} from "@/lib/lantite/types";

export interface SetupChoice {
  kind: TestKind;
  count: QuestionCount;
  difficulty: Difficulty;
  timed: boolean;
  feedback: FeedbackMode;
}

export function SetupPanel({
  inProgress,
  onStart,
  onResume,
  onProgress,
}: {
  inProgress: InProgressAttempt | null;
  onStart: (choice: SetupChoice) => void;
  onResume: () => void;
  onProgress: () => void;
}) {
  const [kind, setKind] = useState<TestKind>("mixed");
  const [count, setCount] = useState<QuestionCount>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [timed, setTimed] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMode>("practice");

  function chooseKind(next: TestKind) {
    setKind(next);
    if (next === "exam") {
      setCount(65);
      setFeedback("exam");
      setTimed(true);
      setDifficulty("standard");
    }
  }

  const available = poolForKind(kind).length;
  const actual = Math.min(count, available);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-bold uppercase tracking-wide text-accent">Practice</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          LANTITE Literacy Practice
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted">{DISCLAIMER}</p>
      </header>

      <p className="lantite-note text-sm leading-relaxed">{DATA_NOTICE}</p>
      <p className="text-sm leading-relaxed text-muted">{BANK_NOTICE}</p>

      {inProgress ? (
        <div className="lantite-panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            A test is in progress: question {inProgress.currentIndex + 1} of {inProgress.questionIds.length}.
          </p>
          <button type="button" className="lantite-btn lantite-btn-primary" onClick={onResume}>
            Resume test
          </button>
        </div>
      ) : null}

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          onStart({ kind, count, difficulty, timed, feedback });
        }}
      >
        <fieldset className="space-y-2">
          <legend className="font-bold">Test</legend>
          <div className="lantite-choice-grid">
            {TEST_KINDS.map((option) => (
              <label key={option} className="lantite-choice">
                <input
                  type="radio"
                  name="kind"
                  checked={kind === option}
                  onChange={() => chooseKind(option)}
                />
                <span>
                  <span className="block font-bold">{KIND_LABELS[option]}</span>
                  <span className="mt-1 block text-sm text-muted">{KIND_DETAILS[option]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-bold">Number of questions</legend>
          <div className="flex flex-wrap gap-2">
            {QUESTION_COUNTS.map((option) => (
              <label key={option} className="lantite-choice min-w-24">
                <input
                  type="radio"
                  name="count"
                  checked={count === option}
                  onChange={() => setCount(option)}
                />
                <span className="font-bold">{option}</span>
              </label>
            ))}
          </div>
          <p className="text-sm text-muted">
            {`This bank has ${available} matching ${available === 1 ? "item" : "items"}. This test will use ${actual}${
              actual < count ? `, not ${count}, because items are never repeated` : ""
            }.`}
          </p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-bold">Difficulty</legend>
          <div className="lantite-choice-grid">
            {DIFFICULTIES.map((option) => (
              <label key={option} className="lantite-choice">
                <input
                  type="radio"
                  name="difficulty"
                  checked={difficulty === option}
                  onChange={() => setDifficulty(option)}
                />
                <span>
                  <span className="block font-bold">{DIFFICULTY_LABELS[option]}</span>
                  <span className="mt-1 block text-sm text-muted">{DIFFICULTY_DETAILS[option]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-bold">Timing</legend>
          <label className="lantite-choice">
            <input type="radio" name="timed" checked={!timed} onChange={() => setTimed(false)} />
            <span>
              <span className="block font-bold">Untimed</span>
              <span className="mt-1 block text-sm text-muted">The time spent is still saved.</span>
            </span>
          </label>
          <label className="lantite-choice">
            <input type="radio" name="timed" checked={timed} onChange={() => setTimed(true)} />
            <span>
              <span className="block font-bold">Timed — {formatDuration(PRACTICE_LIMIT_MS[count])}</span>
              <span className="mt-1 block text-sm text-muted">{TIMER_NOTICE}</span>
            </span>
          </label>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-bold">Feedback</legend>
          {(["practice", "exam"] as const).map((option) => (
            <label key={option} className="lantite-choice">
              <input
                type="radio"
                name="feedback"
                checked={feedback === option}
                onChange={() => setFeedback(option)}
              />
              <span className="font-bold">{FEEDBACK_LABELS[option]}</span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="lantite-btn lantite-btn-primary">
            Start test
          </button>
          <button type="button" className="lantite-btn lantite-btn-secondary" onClick={onProgress}>
            View progress
          </button>
        </div>
      </form>
    </div>
  );
}
