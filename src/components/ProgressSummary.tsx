"use client";

import { pronunciationPairs } from "@/data/pairs";
import type { ProgressState } from "@/types/progress";

type Props = {
  progress: ProgressState;
  onReset: () => void;
};

export function ProgressSummary({ progress, onReset }: Props) {
  const { listening, speaking } = progress;
  const accuracy =
    listening.attempts === 0
      ? null
      : Math.round((listening.correct / listening.attempts) * 100);

  const confused = Object.entries(listening.confusedPairIds)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([pairId, count]) => {
      const pair = pronunciationPairs.find((item) => item.id === pairId);
      return {
        pairId,
        count,
        label: pair ? `${pair.leftWord} — ${pair.rightWord}` : pairId,
      };
    });

  const isEmpty =
    listening.attempts === 0 &&
    speaking.attempts === 0 &&
    progress.currentSequence <= 1;

  const stats = [
    {
      label: "Listening attempts",
      value: String(listening.attempts),
      hint: "Ears training",
      tone: "from-teal/20 to-white",
    },
    {
      label: "Listening accuracy",
      value: accuracy === null ? "—" : `${accuracy}%`,
      hint: `${listening.correct} correct of ${listening.attempts}`,
      tone: "from-accent/15 to-white",
    },
    {
      label: "Speaking attempts",
      value: String(speaking.attempts),
      hint: "Voice practice",
      tone: "from-coral/20 to-white",
    },
    {
      label: "Resume position",
      value: String(progress.currentSequence),
      hint: "Saved on this device",
      tone: "from-amber/30 to-white",
    },
  ];

  return (
    <div className="space-y-4">
      {isEmpty ? (
        <p className="card rounded-[1.5rem] border-dashed px-4 py-8 text-center text-sm text-muted">
          No practice yet. Start on Learn or Practice to light up this board.
        </p>
      ) : null}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`card rounded-[1.5rem] bg-gradient-to-br ${stat.tone} p-4`}
          >
            <dt className="text-sm font-semibold text-muted">{stat.label}</dt>
            <dd className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">
              {stat.value}
            </dd>
            <p className="mt-1 text-xs font-medium text-muted">{stat.hint}</p>
          </div>
        ))}
      </dl>

      <section className="card rounded-[1.5rem] p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden="true">🧩</span> Words often confused
        </h2>
        {confused.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No confusion data yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {confused.map((item) => (
              <li
                key={item.pairId}
                className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-accent-soft to-amber/15 px-3 py-2.5 text-sm font-medium"
              >
                <span>{item.label}</span>
                <span className="chip bg-white text-accent">{item.count}×</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        className="touch-target w-full rounded-2xl border-2 border-danger/40 bg-danger/10 px-4 py-3 font-bold text-danger"
        onClick={() => {
          const confirmed = window.confirm(
            "Reset all local progress on this device? This cannot be undone.",
          );
          if (confirmed) onReset();
        }}
      >
        Reset progress
      </button>
    </div>
  );
}
