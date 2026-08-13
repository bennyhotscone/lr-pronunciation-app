import { describe, expect, it } from "vitest";
import { VOCAB_PRACTICE_DAILY_CAP, utcDayBounds } from "./vocab-practice";

describe("vocab practice", () => {
  it("caps at two packs per day", () => {
    expect(VOCAB_PRACTICE_DAILY_CAP).toBe(2);
  });

  it("returns UTC day bounds", () => {
    const now = new Date("2026-08-13T15:30:00.000Z");
    const { start, end } = utcDayBounds(now);
    expect(start.toISOString()).toBe("2026-08-13T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-14T00:00:00.000Z");
  });
});