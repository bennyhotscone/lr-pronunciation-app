"use client";

import { useEffect, useRef } from "react";
import { PassagePanel } from "@/components/lantite/PassagePanel";
import { bankItemById } from "@/lib/lantite/bank";
import { DISCLAIMER, FEEDBACK_LABELS, formatDuration, KIND_LABELS, optionLetter } from "@/lib/lantite/labels";
import { elapsedNow, remainingMs } from "@/lib/lantite/timer";
import type { InProgressAttempt } from "@/lib/lantite/types";

export function SittingView({
  attempt,
  now,
  onAnswer,
  onFlag,
  onGo,
  onSubmit,
}: {
  attempt: InProgressAttempt;
  now: number;
  onAnswer: (questionId: string, index: number) => void;
  onFlag: (questionId: string) => void;
  onGo: (index: number) => void;
  onSubmit: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const index = attempt.currentIndex;
  const questionId = attempt.questionIds[index] ?? "";
  const item = bankItemById(questionId);
  const selected = attempt.answers[questionId];
  const flagged = attempt.flagged.includes(questionId);
  const answeredCount = attempt.questionIds.filter((id) => typeof attempt.answers[id] === "number").length;
  const showFeedback = attempt.config.feedback === "practice" && typeof selected === "number" && item;
  const remaining = attempt.config.timed ? remainingMs(attempt.timer, attempt.config.count, now) : null;

  useEffect(() => {
    headingRef.current?.focus();
  }, [questionId]);

  if (!item) {
    return (
      <p className="lantite-warn" role="alert">
        Question {questionId || index + 1} is no longer in the practice bank.
      </p>
    );
  }

  const correct = selected === item.question.correctIndex;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-accent">{KIND_LABELS[attempt.config.kind]}</p>
          <p className="text-sm text-muted">{FEEDBACK_LABELS[attempt.config.feedback]}</p>
        </div>
        <p className="text-sm font-bold" aria-live="polite">
          {attempt.config.timed
            ? `Time left ${formatDuration(remaining ?? 0)}`
            : `Time spent ${formatDuration(elapsedNow(attempt.timer, now))}`}
        </p>
      </div>
      <p className="text-sm text-muted">
        Question {index + 1} of {attempt.questionIds.length} · {answeredCount} answered · {attempt.flagged.length} flagged
      </p>
      <div className="lantite-meter" aria-hidden="true">
        <span style={{ width: `${((index + 1) / attempt.questionIds.length) * 100}%` }} />
      </div>
      <p className="text-sm text-muted">{DISCLAIMER}</p>

      <div className="lantite-sit">
        <PassagePanel passage={item.passage} />

        <section className="lantite-panel" aria-labelledby="current-question">
          <h2 id="current-question" ref={headingRef} tabIndex={-1} className="text-lg font-semibold">
            Question {index + 1}
          </h2>
          <p className="mt-2 leading-relaxed">{item.question.stem}</p>
          <fieldset className="mt-4 space-y-2">
            <legend className="sr-only">Answer choices</legend>
            {item.question.options.map((option, optionIndex) => {
              const letter = optionLetter(optionIndex);
              const checked = selected === optionIndex;
              return (
                <label key={letter} className="lantite-choice">
                  <input
                    type="radio"
                    name={`answer-${item.question.id}`}
                    value={optionIndex}
                    checked={checked}
                    onChange={() => onAnswer(item.question.id, optionIndex)}
                  />
                  <span>
                    <span className="font-bold">{letter}. </span>
                    {option}
                  </span>
                </label>
              );
            })}
          </fieldset>

          {showFeedback ? (
            <div className={`lantite-feedback mt-4 ${correct ? "good" : "bad"}`} aria-live="polite">
              <p className="font-bold">{correct ? "Correct." : `Not quite. The answer is ${optionLetter(item.question.correctIndex)}.`}</p>
              <p className="mt-2">{item.question.explanation}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {item.question.options.map((option, optionIndex) => (
                  <li key={optionLetter(optionIndex)}>
                    <strong>
                      {optionLetter(optionIndex)}
                      {optionIndex === item.question.correctIndex ? " is correct. " : " is not correct. "}
                    </strong>
                    {item.question.optionWhy[optionIndex]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="lantite-btn lantite-btn-secondary" onClick={() => onGo(index - 1)} disabled={index === 0}>
              Previous
            </button>
            <button
              type="button"
              className="lantite-btn lantite-btn-secondary"
              onClick={() => onGo(index + 1)}
              disabled={index >= attempt.questionIds.length - 1}
            >
              Next
            </button>
            <button
              type="button"
              className="lantite-btn lantite-btn-secondary"
              aria-pressed={flagged}
              onClick={() => onFlag(item.question.id)}
            >
              {flagged ? "Flagged for review" : "Flag for review"}
            </button>
            <button type="button" className="lantite-btn lantite-btn-primary" onClick={onSubmit}>
              Submit test
            </button>
          </div>
        </section>
      </div>

      <nav aria-label="Question navigator" className="lantite-panel">
        <p className="mb-2 text-sm text-muted">Answered questions are filled. Flagged questions have a gold bar. The current question has a blue outline.</p>
        <div className="lantite-nav-grid">
          {attempt.questionIds.map((id, buttonIndex) => {
            const isAnswered = typeof attempt.answers[id] === "number";
            const isFlagged = attempt.flagged.includes(id);
            return (
              <button
                key={id}
                type="button"
                className="lantite-qbtn"
                aria-current={buttonIndex === index ? "true" : undefined}
                aria-label={`Question ${buttonIndex + 1}${isAnswered ? ", answered" : ", not answered"}${isFlagged ? ", flagged" : ""}`}
                data-answered={isAnswered ? "true" : "false"}
                data-flagged={isFlagged ? "true" : "false"}
                onClick={() => onGo(buttonIndex)}
              >
                {buttonIndex + 1}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
