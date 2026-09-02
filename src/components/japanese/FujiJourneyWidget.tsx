"use client";

import {
  altitudeToClimberY,
  computeJourneyPoints,
  FUJI_STAGES,
  getCurrentStage,
  getNextStage,
  getUnlockedStages,
  pointsToAltitude,
  type JapaneseJourneyStats,
} from "@/lib/japanese/fuji-journey";

type Props = {
  stats: JapaneseJourneyStats | null;
  loading?: boolean;
};

export function FujiJourneyWidget({ stats, loading }: Props) {
  if (loading) {
    return (
      <section className="jp-fuji" aria-label="Mount Fuji climb progress">
        <p className="jp-fuji-meta">Loading climb progress…</p>
      </section>
    );
  }

  if (!stats) return null;

  const points = computeJourneyPoints(stats);
  const altitudeM = pointsToAltitude(points);
  const stage = getCurrentStage(points);
  const nextStage = getNextStage(points);
  const unlocked = new Set(getUnlockedStages(points).map((s) => s.id));
  const climberT = altitudeToClimberY(altitudeM);
  const climberY = 88 - climberT * 58;
  const progressPct = Math.round((altitudeM / FUJI_STAGES[FUJI_STAGES.length - 1].altitudeM) * 100);

  return (
    <section className="jp-fuji" aria-label="Mount Fuji climb progress">
      <div className="jp-fuji-head">
        <div>
          <p className="jp-fuji-kicker">Your climb</p>
          <h2 className="jp-fuji-title">
            {stage.labelJa}
            <span className="jp-fuji-title-en">{stage.label}</span>
          </h2>
        </div>
        <div className="jp-fuji-stats">
          <span className="jp-fuji-alt">{altitudeM.toLocaleString()} m</span>
          <span className="jp-fuji-points">{points} pts</span>
        </div>
      </div>

      <div className="jp-fuji-scene" role="img" aria-hidden="true">
        <svg viewBox="0 0 320 120" className="jp-fuji-svg">
          <defs>
            <linearGradient id="jp-fuji-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f9e8d8" />
              <stop offset="55%" stopColor="#f3dcc8" />
              <stop offset="100%" stopColor="#e8d5c0" />
            </linearGradient>
            <linearGradient id="jp-fuji-snow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#faf8f4" />
              <stop offset="100%" stopColor="#ddd7cb" />
            </linearGradient>
          </defs>
          <rect width="320" height="120" fill="url(#jp-fuji-sky)" rx="12" />

          {unlocked.has("approach") ? (
            <ellipse cx="160" cy="92" rx="120" ry="14" fill="rgba(255,255,255,0.55)" />
          ) : null}

          <path d="M40 95 L160 28 L280 95 Z" fill="#3d3832" opacity="0.92" />
          <path
            d="M120 95 L160 28 L200 95 Z"
            fill="url(#jp-fuji-snow)"
            opacity={unlocked.has("treeline") ? 1 : 0.35}
          />

          {unlocked.has("forest") ? (
            <>
              <rect x="52" y="86" width="4" height="9" fill="#5a6b52" rx="1" />
              <rect x="66" y="84" width="4" height="11" fill="#5a6b52" rx="1" />
              <rect x="248" y="86" width="4" height="9" fill="#5a6b52" rx="1" />
              <rect x="262" y="84" width="4" height="11" fill="#5a6b52" rx="1" />
            </>
          ) : null}

          {unlocked.has("station5") ? (
            <g transform="translate(148 72)">
              <rect x="0" y="8" width="24" height="3" fill="#8b3a3a" rx="1" />
              <rect x="3" y="5" width="3" height="11" fill="#5c3030" />
              <rect x="18" y="5" width="3" height="11" fill="#5c3030" />
            </g>
          ) : null}

          <path
            d="M72 95 Q160 55 248 95"
            fill="none"
            stroke="#6b6258"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.7"
          />

          <circle cx={72 + climberT * 176} cy={climberY} r="4.5" fill="#222" />
          {unlocked.has("summit") ? (
            <g transform="translate(156 24)">
              <line x1="4" y1="0" x2="4" y2="10" stroke="#8b3a3a" strokeWidth="1.2" />
              <path d="M0 0 L8 0 L4 5 Z" fill="#8b3a3a" />
            </g>
          ) : null}
        </svg>
      </div>

      <div className="jp-fuji-bar" aria-hidden="true">
        <div style={{ width: `${progressPct}%` }} />
      </div>

      <p className="jp-fuji-meta">
        {nextStage
          ? `${nextStage.minPoints - points} pts to ${nextStage.labelJa} (${nextStage.label})`
          : "Summit reached — keep training to stay sharp."}
      </p>

      <ul className="jp-fuji-stages">
        {FUJI_STAGES.map((s) => (
          <li
            key={s.id}
            className={unlocked.has(s.id) ? "jp-fuji-stage jp-fuji-stage-unlocked" : "jp-fuji-stage"}
          >
            <span>{s.labelJa}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
