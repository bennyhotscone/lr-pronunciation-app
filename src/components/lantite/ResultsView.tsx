"use client";

import { PassagePanel } from "@/components/lantite/PassagePanel";
import { bankItemById } from "@/lib/lantite/bank";
import type { GradeReport } from "@/lib/lantite/grade";
import {
  DISCLAIMER,
  formatDuration,
  formatPercent,
  KIND_LABELS,
  optionLetter,
  SCORE_NOTICE,
  SKILL_LABELS,
  STUDY_SUGGESTIONS,
} from "@/lib/lantite/labels";
import type { CompletedAttempt } from "@/lib/lantite/types";

export function ResultsView({
  attempt,
  grade,
  onReview,
  onProgress,
}: {
  attempt: CompletedAttempt;
  grade: GradeReport;
  onReview: () => void;
  onProgress: () => void;
}) {
  const weak = grade.bySkill.filter((row) => row.total > 0 && row.correct / row.total < 0.7);
  const incorrect = grade.rows.filter((row) => !row.missing && !row.right);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-bold text-accent">Results</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          {grade.correct} of {grade.total} correct ({formatPercent(grade.correct, grade.total)})
        </h1>
        <p className="mt-2 text-sm text-muted">
          {KIND_LABELS[attempt.config.kind]} · {attempt.timedOut ? "Time ran out. " : ""}
          Time {formatDuration(attempt.elapsedMs)} · {grade.unanswered} unanswered
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">{SCORE_NOTICE}</p>
        <p className="mt-1 text-sm text-muted">{DISCLAIMER}</p>
      </header>

      {grade.missing > 0 ? (
        <p className="lantite-warn">{grade.missing} item(s) from this attempt are no longer in the bank and were left out of the score.</p>
      ) : null}

      <section className="lantite-panel" aria-labelledby="category-heading">
        <h2 id="category-heading" className="text-xl font-semibold">Category breakdown</h2>
        <table className="lantite-table mt-2">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Correct</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Reading</td>
              <td>
                {grade.byCategory.reading.correct} of {grade.byCategory.reading.total}
              </td>
            </tr>
            <tr>
              <td>Grammar, spelling and punctuation</td>
              <td>
                {grade.byCategory.conventions.correct} of {grade.byCategory.conventions.total}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="lantite-panel" aria-labelledby="skill-heading">
        <h2 id="skill-heading" className="text-xl font-semibold">Skill breakdown</h2>
        <table className="lantite-table mt-2">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Correct</th>
            </tr>
          </thead>
          <tbody>
            {grade.bySkill.map((row) => (
              <tr key={row.skill}>
                <td>{SKILL_LABELS[row.skill]}</td>
                <td>
                  {row.correct} of {row.total} ({formatPercent(row.correct, row.total)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="lantite-panel" aria-labelledby="pitfall-heading">
        <h2 id="pitfall-heading" className="text-xl font-semibold">Common pitfalls in this attempt</h2>
        {grade.pitfallMisses.length === 0 ? (
          <p className="mt-2 text-muted">No tagged pitfalls were missed.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {grade.pitfallMisses.map((miss) => (
              <li key={miss.id}>
                {miss.label} ({miss.count})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lantite-panel" aria-labelledby="study-heading">
        <h2 id="study-heading" className="text-xl font-semibold">Study suggestions</h2>
        {weak.length === 0 ? (
          <p className="mt-2 text-muted">No skill was under 70 per cent in this attempt. Review any incorrect item below anyway.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-2 pl-5">
            {weak.map((row) => (
              <li key={row.skill}>
                <strong>{SKILL_LABELS[row.skill]}.</strong> {STUDY_SUGGESTIONS[row.skill]}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="lantite-btn lantite-btn-primary" onClick={onReview}>
          Review incorrect answers
        </button>
        <button type="button" className="lantite-btn lantite-btn-secondary" onClick={onProgress}>
          View progress
        </button>
      </div>

      <section className="space-y-2" aria-labelledby="review-all-heading">
        <h2 id="review-all-heading" className="text-xl font-semibold">
          All questions ({incorrect.length} incorrect)
        </h2>
        {grade.rows.map((row, index) => {
          const item = bankItemById(row.id);
          if (!item || row.missing) {
            return (
              <p key={row.id} className="lantite-warn">
                Question {index + 1} is no longer in the bank.
              </p>
            );
          }
          return (
            <details key={row.id} className="lantite-panel" open={!row.right}>
              <summary className="cursor-pointer font-bold">
                Question {index + 1} · {row.right ? "Correct" : "Incorrect"} · {SKILL_LABELS[item.question.skill]}
              </summary>
              <div className="mt-3">
                <PassagePanel passage={item.passage} />
              </div>
              <p className="mt-3">{item.question.stem}</p>
              <p className="mt-2 text-sm">
                Your answer: {row.selected == null ? "Not answered" : `${optionLetter(row.selected)}. ${item.question.options[row.selected]}`}
              </p>
              <p className="mt-1 text-sm">
                Correct answer: {optionLetter(item.question.correctIndex)}. {item.question.options[item.question.correctIndex]}
              </p>
              <p className="mt-3">{item.question.explanation}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {item.question.options.map((option, optionIndex) => (
                  <li key={optionLetter(optionIndex)}>
                    <strong>
                      {optionLetter(optionIndex)}. {option}
                      {optionIndex === item.question.correctIndex ? " — correct. " : " — not correct. "}
                    </strong>
                    {item.question.optionWhy[optionIndex]}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </section>
    </div>
  );
}

export function ReviewSession({
  attempt,
  index,
  onIndex,
  onBack,
}: {
  attempt: CompletedAttempt;
  index: number;
  onIndex: (index: number) => void;
  onBack: () => void;
}) {
  const gradeIds = attempt.questionIds.filter((id) => {
    const item = bankItemById(id);
    return item != null && attempt.answers[id] !== item.question.correctIndex;
  });
  const safeIndex = Math.min(index, Math.max(0, gradeIds.length - 1));
  const id = gradeIds[safeIndex];
  const item = id ? bankItemById(id) : undefined;

  return (
    <div className="space-y-4">
      <button type="button" className="lantite-btn lantite-btn-secondary" onClick={onBack}>
        Back to results
      </button>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Review incorrect answers</h1>
      {gradeIds.length === 0 || !item ? (
        <p className="lantite-panel">You had no incorrect answers in this attempt.</p>
      ) : (
        <article className="space-y-4">
          <p className="text-sm text-muted">
            Item {safeIndex + 1} of {gradeIds.length} · {SKILL_LABELS[item.question.skill]}
          </p>
          <PassagePanel passage={item.passage} />
          <div className="lantite-panel">
          <p className="font-semibold">{item.question.stem}</p>
          <ul className="mt-3 space-y-2">
            {item.question.options.map((option, optionIndex) => (
              <li key={optionLetter(optionIndex)}>
                <strong>{optionLetter(optionIndex)}.</strong> {option}
              </li>
            ))}
          </ul>
          <p className="mt-4">
            Your answer:{" "}
            {typeof attempt.answers[item.question.id] === "number"
              ? optionLetter(attempt.answers[item.question.id] as number)
              : "Not answered"}
            . Correct answer: {optionLetter(item.question.correctIndex)}.
          </p>
          <p className="mt-3">{item.question.explanation}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {item.question.optionWhy.map((why, optionIndex) => (
              <li key={optionLetter(optionIndex)}>
                <strong>
                  {optionLetter(optionIndex)}
                  {optionIndex === item.question.correctIndex ? " is correct. " : " is not correct. "}
                </strong>
                {why}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <button type="button" className="lantite-btn lantite-btn-secondary" disabled={safeIndex === 0} onClick={() => onIndex(safeIndex - 1)}>
              Previous incorrect
            </button>
            <button
              type="button"
              className="lantite-btn lantite-btn-secondary"
              disabled={safeIndex >= gradeIds.length - 1}
              onClick={() => onIndex(safeIndex + 1)}
            >
              Next incorrect
            </button>
          </div>
          </div>
        </article>
      )}
    </div>
  );
}
