import Link from "next/link";
import { MOCKUP_UI } from "@/lib/mockup-ui";

export type PyramidGoal = {
  id: string;
  title: string;
  description: string | null;
  progressPct: number;
  source: string;
  pyramidTier: number;
  checklistItems: { id: string; title: string; done: boolean }[];
};

const TIER_META: Record<number, { label: string; hint: string }> = {
  3: { label: "Specialty", hint: "Narrow skills you are refining" },
  2: { label: "Focus areas", hint: "Core class and homework targets" },
  1: { label: "Foundation", hint: "Broader knowledge at the base" },
};

function tierFor(goal: PyramidGoal) {
  const t = goal.pyramidTier;
  if (t === 1 || t === 3) return t;
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
        </div>
        <Link
          href="/portal/goals"
          className="text-sm font-bold text-desk-accent underline-offset-2 hover:underline"
        >
          Full targets page →
        </Link>
      </div>

      <div className="mockup-chrome relative mx-auto max-w-lg overflow-hidden rounded-2xl">
        <img
          src={MOCKUP_UI.pyramid}
          alt="Learning pyramid"
          className="mockup-img w-full"
          width={1380}
          height={2160}
          decoding="async"
        />
        <Link
          href="/portal/goals"
          className="absolute left-[18%] top-[12%] h-[18%] w-[64%]"
          aria-label="Specialty targets"
        />
        <Link
          href="/portal/goals"
          className="absolute left-[12%] top-[32%] h-[16%] w-[76%]"
          aria-label="Focus area targets"
        />
        <Link
          href="/portal/goals"
          className="absolute left-[8%] top-[50%] h-[16%] w-[84%]"
          aria-label="Classroom talk targets"
        />
        <Link
          href="/portal/goals"
          className="absolute left-[4%] top-[68%] h-[22%] w-[92%]"
          aria-label="Foundation targets"
        />
      </div>

      <div className="space-y-3">
        {tiers.map((band) => (
          <div key={band.tier} className="rounded-xl border border-desk-accent/15 bg-white/85 px-3 py-2">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
                {band.label}
              </p>
              <p className="text-xs font-bold text-muted">{band.goals.length}</p>
            </div>
            {band.goals.length ? (
              <ul className="space-y-2">
                {band.goals.map((g) => {
                  const total = g.checklistItems.length;
                  const done = g.checklistItems.filter((i) => i.done).length;
                  const showItems = compact ? g.checklistItems.slice(0, 2) : g.checklistItems;
                  return (
                    <li key={g.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold text-ink">{g.title}</p>
                        <p className="text-xs font-bold text-desk-accent">
                          {total ? `${done}/${total}` : `${g.progressPct}%`}
                        </p>
                      </div>
                      {!compact && g.description ? (
                        <p className="mt-0.5 text-sm text-ink/55">{g.description}</p>
                      ) : null}
                      <div className="progress-bar mt-1.5">
                        <span style={{ width: `${g.progressPct}%` }} />
                      </div>
                      {showItems.length ? (
                        <ul className="mt-1.5 space-y-1">
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
                          {compact && total > 2 ? (
                            <li className="text-xs text-ink/45">+{total - 2} more on full page</li>
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
        Only your teacher confirms checklist items
      </p>
    </div>
  );
}