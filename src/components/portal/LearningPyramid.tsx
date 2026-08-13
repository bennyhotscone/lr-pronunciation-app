import Link from "next/link";

export type PyramidGoal = {
  id: string;
  title: string;
  description: string | null;
  progressPct: number;
  source: string;
  pyramidTier: number;
  checklistItems: { id: string; title: string; done: boolean }[];
};

const TIER_META: Record<number, { label: string; hint: string; width: string }> = {
  3: {
    label: "Specialized targets",
    hint: "Narrow skills you are refining right now",
    width: "w-[58%]",
  },
  2: {
    label: "Focus areas",
    hint: "Core class and homework targets",
    width: "w-[78%]",
  },
  1: {
    label: "General foundation",
    hint: "Broader knowledge that supports everything above",
    width: "w-full",
  },
};

function tierFor(goal: PyramidGoal) {
  const t = goal.pyramidTier;
  if (t === 1 || t === 3) return t;
  // Soft default: self-help requests sit lower as foundation work
  if (goal.source === "STUDENT_HELP") return 1;
  return 2;
}

export function LearningPyramid({
  goals,
  compact = false,
}: {
  goals: PyramidGoal[];
  compact?: boolean;
}) {
  const tiers = [3, 2, 1].map((tier) => ({
    tier,
    ...TIER_META[tier],
    goals: goals.filter((g) => tierFor(g) === tier),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
            Learning targets
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
            Your learning pyramid
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            General knowledge at the base, more specialized goals toward the top.
          </p>
        </div>
        <Link
          href="/portal/goals"
          className="text-sm font-bold text-desk-accent underline-offset-2 hover:underline"
        >
          Full targets page →
        </Link>
      </div>

      <div className="flex flex-col items-center gap-2">
        {tiers.map((band) => (
          <div
            key={band.tier}
            className={`${band.width} rounded-xl border border-desk-accent/20 bg-paper px-4 py-3 shadow-sm`}
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
                  {band.label}
                </p>
                <p className="text-[0.7rem] text-ink/50">{band.hint}</p>
              </div>
              <p className="text-xs font-bold text-muted">{band.goals.length}</p>
            </div>
            {band.goals.length ? (
              <ul className="space-y-3">
                {band.goals.map((g) => {
                  const total = g.checklistItems.length;
                  const done = g.checklistItems.filter((i) => i.done).length;
                  const showItems = compact
                    ? g.checklistItems.slice(0, 3)
                    : g.checklistItems;
                  return (
                    <li key={g.id} className="rounded-lg border border-wood/15 bg-white/80 px-3 py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold text-ink">{g.title}</p>
                        <p className="text-xs font-bold text-desk-accent">
                          {total ? `${done}/${total}` : `${g.progressPct}%`}
                        </p>
                      </div>
                      {!compact && g.description ? (
                        <p className="mt-1 text-sm text-ink/55">{g.description}</p>
                      ) : null}
                      <div className="progress-bar mt-2">
                        <span style={{ width: `${g.progressPct}%` }} />
                      </div>
                      {showItems.length ? (
                        <ul className="mt-2 space-y-1">
                          {showItems.map((item) => (
                            <li key={item.id} className="flex items-start gap-2 text-sm text-ink/80">
                              <span
                                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                  item.done
                                    ? "border-desk-accent bg-desk-accent text-paper"
                                    : "border-wood/40 bg-white text-transparent"
                                }`}
                                aria-hidden
                              >
                                ✓
                              </span>
                              <span className={item.done ? "text-ink/45 line-through" : ""}>
                                {item.title}
                              </span>
                            </li>
                          ))}
                          {compact && total > 3 ? (
                            <li className="text-xs text-ink/45">+{total - 3} more on full page</li>
                          ) : null}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink/50">No targets in this band yet.</p>
            )}
          </div>
        ))}
      </div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink/40">
        Only your teacher confirms checklist items — they guide class and homework
      </p>
    </div>
  );
}