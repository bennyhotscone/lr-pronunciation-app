"use client";

import { summariseHistory } from "@/lib/lantite/grade";
import {
  DATA_NOTICE,
  DIFFICULTY_LABELS,
  DISCLAIMER,
  formatPercent,
  KIND_LABELS,
  SCORE_NOTICE,
  SKILL_LABELS,
} from "@/lib/lantite/labels";
import type { CompletedAttempt } from "@/lib/lantite/types";

export function ProgressPanel({
  history,
  onOpen,
  onSetup,
}: {
  history: readonly CompletedAttempt[];
  onOpen: (id: string) => void;
  onSetup: () => void;
}) {
  const summary = summariseHistory(history);
  const recent = summary.trend.slice(-8);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Progress on this device</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{DATA_NOTICE}</p>
        <p className="mt-2 text-sm">{SCORE_NOTICE}</p>
        <p className="mt-1 text-sm text-muted">{DISCLAIMER}</p>
      </header>

      <p className="lantite-panel">
        Completed attempts: <strong>{summary.attempts}</strong>
      </p>

      <section className="lantite-panel" aria-labelledby="trend-heading">
        <h2 id="trend-heading" className="text-xl font-semibold">Recent results</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-muted">No completed tests yet.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {recent.map((point) => {
              const width = point.total === 0 ? 0 : Math.round((point.correct / point.total) * 100);
              return (
                <li key={point.id}>
                  <div className="flex justify-between text-sm">
                    <span>{new Date(point.completedAt).toLocaleString("en-AU")}</span>
                    <span>
                      {point.correct}/{point.total} ({formatPercent(point.correct, point.total)})
                    </span>
                  </div>
                  <div className="lantite-meter mt-1" aria-hidden="true">
                    <span style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="lantite-panel" aria-labelledby="skill-progress-heading">
        <h2 id="skill-progress-heading" className="text-xl font-semibold">Accuracy by skill</h2>
        {summary.bySkill.length === 0 ? (
          <p className="mt-2 text-muted">Finish a test to see skill accuracy.</p>
        ) : (
          <table className="lantite-table mt-2">
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Correct</th>
              </tr>
            </thead>
            <tbody>
              {summary.bySkill.map((row) => (
                <tr key={row.skill}>
                  <td>{SKILL_LABELS[row.skill]}</td>
                  <td>
                    {row.correct} of {row.total} ({formatPercent(row.correct, row.total)})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="lantite-panel" aria-labelledby="pitfall-progress-heading">
        <h2 id="pitfall-progress-heading" className="text-xl font-semibold">Most common pitfalls</h2>
        {summary.pitfallMisses.length === 0 ? (
          <p className="mt-2 text-muted">No tagged pitfalls have been missed yet.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {summary.pitfallMisses.map((miss) => (
              <li key={miss.id}>
                {miss.label} — missed {miss.count} {miss.count === 1 ? "time" : "times"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lantite-panel" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-xl font-semibold">Completed attempts</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-muted">Nothing saved yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...history].reverse().map((attempt) => {
              const point = summary.trend.find((item) => item.id === attempt.id);
              return (
                <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">
                    {new Date(attempt.completedAt).toLocaleString("en-AU")} · {KIND_LABELS[attempt.config.kind]} ·{" "}
                    {DIFFICULTY_LABELS[attempt.config.difficulty]} · {point ? `${point.correct}/${point.total}` : ""}
                  </span>
                  <button type="button" className="lantite-btn lantite-btn-secondary" onClick={() => onOpen(attempt.id)}>
                    Open results
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button type="button" className="lantite-btn lantite-btn-primary" onClick={onSetup}>
        New test
      </button>
    </div>
  );
}
