import { describe, expect, it } from "vitest";
import {
  computeJourneyPoints,
  FUJI_STAGES,
  getCurrentStage,
  getNextStage,
  getUnlockedStages,
  pointsToAltitude,
} from "@/lib/japanese/fuji-journey";

describe("fuji journey", () => {
  it("computes points from training stats", () => {
    const points = computeJourneyPoints({
      totalCorrect: 40,
      knownWords: 5,
      blocksMastered: 0,
      roundsPassed: 2,
      gatesPassed: 0,
    });
    expect(points).toBe(40 + 15 + 30);
  });

  it("unlocks stages at point thresholds", () => {
    expect(getCurrentStage(0).id).toBe("base");
    expect(getCurrentStage(29).id).toBe("base");
    expect(getCurrentStage(30).id).toBe("forest");
    expect(getCurrentStage(120).id).toBe("station5");
    expect(getUnlockedStages(280).map((s) => s.id)).toEqual([
      "base",
      "forest",
      "station5",
      "treeline",
    ]);
  });

  it("interpolates altitude between stages", () => {
    expect(pointsToAltitude(0)).toBe(0);
    expect(pointsToAltitude(30)).toBe(800);
    expect(pointsToAltitude(75)).toBeGreaterThan(800);
    expect(pointsToAltitude(75)).toBeLessThan(1500);
    expect(pointsToAltitude(1000)).toBe(FUJI_STAGES[FUJI_STAGES.length - 1].altitudeM);
  });

  it("reports the next stage to unlock", () => {
    expect(getNextStage(10)?.id).toBe("forest");
    expect(getNextStage(1000)).toBeNull();
  });
});
