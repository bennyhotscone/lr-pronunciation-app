import { describe, expect, it } from "vitest";
import { pronunciationPairs } from "@/data/pairs";
import { PAIR_COUNT } from "@/lib/pair-utils";

describe("pronunciationPairs integrity", () => {
  it("contains exactly 127 entries", () => {
    expect(pronunciationPairs).toHaveLength(127);
    expect(PAIR_COUNT).toBe(127);
  });

  it("uses contiguous sequences from 1 to 127", () => {
    const sequences = pronunciationPairs.map((pair) => pair.sequence);
    expect(sequences).toEqual(Array.from({ length: 127 }, (_, i) => i + 1));
  });

  it("preserves intentional repetitions", () => {
    const flyFry = pronunciationPairs.filter(
      (pair) => pair.leftWord === "fly" && pair.rightWord === "fry",
    );
    expect(flyFry.length).toBeGreaterThan(1);
  });

  it("includes the authorised cloud — crowd correction", () => {
    const cloudCrowd = pronunciationPairs.find(
      (pair) => pair.leftWord === "cloud" && pair.rightWord === "crowd",
    );
    expect(cloudCrowd).toBeDefined();
    expect(cloudCrowd?.id).toBe("cloud-crowd-1");
    expect(cloudCrowd?.sequence).toBe(81);

    const cloudyCrowded = pronunciationPairs.find(
      (pair) =>
        pair.leftWord === "cloudy" ||
        pair.rightWord === "crowded" ||
        pair.leftWord === "crowded",
    );
    expect(cloudyCrowded).toBeUndefined();
  });

  it("keeps unique ids even when word pairs repeat", () => {
    const ids = pronunciationPairs.map((pair) => pair.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
