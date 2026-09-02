"use client";

import {
  computeJourneyPoints,
  FUJI_STAGES,
  getCurrentStage,
  getNextStage,
  type JapaneseJourneyStats,
} from "@/lib/japanese/fuji-journey";

type Props = {
  stats: JapaneseJourneyStats | null;
  loading?: boolean;
};

const GOAL_POINTS = FUJI_STAGES[FUJI_STAGES.length - 1].minPoints;

export function JourneyThermometerWidget({ stats, loading }: Props) {
  if (loading) {
    return (
      <section className="jp-journey" aria-label="Training progress">
        <p className="jp-journey-meta">Loading progress…</p>
      </section>
    );
  }

  if (!stats) return null;

  const points = computeJourneyPoints(stats);
  const stage = getCurrentStage(points);
  const nextStage = getNextStage(points);
  const fillPct = Math.min(100, Math.round((points / GOAL_POINTS) * 100));

  return (
    <section className="jp-journey" aria-label="Training progress">
      <div className="jp-journey-head">
        <div>
          <p className="jp-journey-kicker">Progress</p>
          <p className="jp-journey-stage">{stage.label}</p>
        </div>
        <div className="jp-journey-points">
          <span className="jp-journey-points-value">{points.toLocaleString()}</span>
          <span className="jp-journey-points-label">/ {GOAL_POINTS.toLocaleString()} pts</span>
        </div>
      </div>

      <div className="jp-journey-thermo-wrap">
        <div
          className="jp-journey-thermo"
          role="progressbar"
          aria-valuenow={points}
          aria-valuemin={0}
          aria-valuemax={GOAL_POINTS}
          aria-label={`${points} of ${GOAL_POINTS} points`}
        >
          <div className="jp-journey-thermo-track">
            <div className="jp-journey-thermo-fill" style={{ height: `${fillPct}%` }} />
          </div>
          <div className="jp-journey-thermo-bulb" aria-hidden="true" />
        </div>
        <div className="jp-journey-thermo-side">
          <span className="jp-journey-pct">{fillPct}%</span>
          <p className="jp-journey-meta">
            {nextStage
              ? `${(nextStage.minPoints - points).toLocaleString()} pts to ${nextStage.label}`
              : "Goal reached — keep training."}
          </p>
        </div>
      </div>
    </section>
  );
}
