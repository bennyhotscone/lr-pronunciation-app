/** Mount Fuji climb — motivational progress derived from real training stats. */

export type JapaneseJourneyStats = {
  totalCorrect: number;
  knownWords: number;
  blocksMastered: number;
  /** Round completions at or above mastery threshold (90%). */
  roundsPassed: number;
  gatesPassed: number;
};

export type FujiStage = {
  id: string;
  label: string;
  labelJa: string;
  altitudeM: number;
  minPoints: number;
};

export const FUJI_SUMMIT_ALTITUDE = 3776;

export const JOURNEY_POINTS = {
  perCorrectAnswer: 1,
  perKnownWord: 3,
  perRoundPassed: 15,
  perBlockMastered: 75,
  perGatePassed: 50,
} as const;

export const FUJI_STAGES: FujiStage[] = [
  { id: "base", label: "Base camp", labelJa: "登山口", altitudeM: 0, minPoints: 0 },
  { id: "forest", label: "Forest trail", labelJa: "樹海", altitudeM: 800, minPoints: 30 },
  { id: "station5", label: "5th Station", labelJa: "五合目", altitudeM: 1500, minPoints: 120 },
  { id: "treeline", label: "Tree line", labelJa: "森林限界", altitudeM: 2400, minPoints: 280 },
  { id: "approach", label: "Summit approach", labelJa: "山頂付近", altitudeM: 3200, minPoints: 550 },
  { id: "summit", label: "Summit", labelJa: "山頂", altitudeM: FUJI_SUMMIT_ALTITUDE, minPoints: 1000 },
];

export function computeJourneyPoints(stats: JapaneseJourneyStats): number {
  return (
    stats.totalCorrect * JOURNEY_POINTS.perCorrectAnswer +
    stats.knownWords * JOURNEY_POINTS.perKnownWord +
    stats.roundsPassed * JOURNEY_POINTS.perRoundPassed +
    stats.blocksMastered * JOURNEY_POINTS.perBlockMastered +
    stats.gatesPassed * JOURNEY_POINTS.perGatePassed
  );
}

export function getCurrentStage(points: number): FujiStage {
  let current = FUJI_STAGES[0];
  for (const stage of FUJI_STAGES) {
    if (points >= stage.minPoints) current = stage;
    else break;
  }
  return current;
}

export function getUnlockedStages(points: number): FujiStage[] {
  return FUJI_STAGES.filter((stage) => points >= stage.minPoints);
}

export function getNextStage(points: number): FujiStage | null {
  return FUJI_STAGES.find((stage) => points < stage.minPoints) ?? null;
}

export function pointsToAltitude(points: number): number {
  const summit = FUJI_STAGES[FUJI_STAGES.length - 1];
  if (points >= summit.minPoints) return summit.altitudeM;

  for (let i = 0; i < FUJI_STAGES.length - 1; i++) {
    const curr = FUJI_STAGES[i];
    const next = FUJI_STAGES[i + 1];
    if (points < next.minPoints) {
      const span = next.minPoints - curr.minPoints;
      if (span <= 0) return curr.altitudeM;
      const t = (points - curr.minPoints) / span;
      return Math.round(curr.altitudeM + t * (next.altitudeM - curr.altitudeM));
    }
  }

  return summit.altitudeM;
}

/** Climber position 0–1 along the mountain slope for SVG placement. */
export function altitudeToClimberY(altitudeM: number): number {
  return Math.min(1, Math.max(0, altitudeM / FUJI_SUMMIT_ALTITUDE));
}
