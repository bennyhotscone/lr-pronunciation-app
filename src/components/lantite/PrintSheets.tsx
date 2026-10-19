import { buildAnswerKey, buildStudentPaper } from "@/lib/lantite/export";
import { gradeAttempt } from "@/lib/lantite/grade";
import {
  DATA_NOTICE,
  DIFFICULTY_LABELS,
  DISCLAIMER,
  formatDuration,
  formatPercent,
  KIND_LABELS,
  SCORE_NOTICE,
  SKILL_LABELS,
  TEXT_TYPE_LABELS,
} from "@/lib/lantite/labels";
import type { CompletedAttempt, TextType } from "@/lib/lantite/types";

function typeLabel(value: string): string {
  return value in TEXT_TYPE_LABELS ? TEXT_TYPE_LABELS[value as TextType] : value;
}

export function PrintTest({ questionIds }: { questionIds: readonly string[] }) {
  const groups = buildStudentPaper(questionIds);
  return (
    <article>
      <h1>Literacy practice paper</h1>
      <p>{DISCLAIMER}</p>
      <p>Answers are not printed on this paper.</p>
      {groups.map((group) => (
        <section key={`${group.passageId}-${group.questions[0]?.number ?? 0}`}>
          <div className="lantite-print-passage">
            <h2>{group.title}</h2>
            <p>{typeLabel(group.textTypeLabel)}</p>
            <p className="lantite-prose">{group.text}</p>
          </div>
          {group.questions.map((question) => (
            <div className="lantite-print-question" key={question.number}>
              <p>
                <strong>{question.number}.</strong> {question.stem}
              </p>
              <ol type="A">
                {question.options.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}

export function PrintKey({ questionIds }: { questionIds: readonly string[] }) {
  const groups = buildAnswerKey(questionIds);
  return (
    <article>
      <h1>Teacher answer key</h1>
      <p>{DISCLAIMER}</p>
      <p>This key is separate from the student paper. Do not print it on the student copy.</p>
      {groups.map((group) => (
        <section key={`${group.passageId}-${group.questions[0]?.number ?? 0}`}>
          <div className="lantite-print-passage">
            <h2>{group.title}</h2>
            <p>{typeLabel(group.textTypeLabel)}</p>
            <p className="lantite-prose">{group.text}</p>
          </div>
          {group.questions.map((question) => (
            <div className="lantite-print-question" key={question.number}>
              <p>
                <strong>
                  {question.number}. {question.correctLetter}
                </strong>{" "}
                — {question.skillLabel}
              </p>
              <p>{question.stem}</p>
              <p>{question.explanation}</p>
              <ul>
                {question.optionNotes.map((note) => (
                  <li key={note.letter}>
                    <strong>
                      {note.letter}
                      {note.correct ? " (correct)" : ""}:
                    </strong>{" "}
                    {note.why}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}

export function PrintReport({ attempt }: { attempt: CompletedAttempt }) {
  const grade = gradeAttempt(attempt);
  return (
    <article>
      <h1>Practice results</h1>
      <p>{DISCLAIMER}</p>
      <p>{SCORE_NOTICE}</p>
      <p>
        {new Date(attempt.completedAt).toLocaleString("en-AU")} · {KIND_LABELS[attempt.config.kind]} ·{" "}
        {DIFFICULTY_LABELS[attempt.config.difficulty]} · {grade.correct} of {grade.total} (
        {formatPercent(grade.correct, grade.total)}) · Time {formatDuration(attempt.elapsedMs)}
      </p>
      <h2>By skill</h2>
      <ul>
        {grade.bySkill.map((row) => (
          <li key={row.skill}>
            {SKILL_LABELS[row.skill]}: {row.correct} of {row.total}
          </li>
        ))}
      </ul>
      <p>{DATA_NOTICE}</p>
    </article>
  );
}
