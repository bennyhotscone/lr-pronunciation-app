import { describe, expect, it } from "vitest";
import { isUnlockedDeskTheme, normalizeDeskTheme } from "./desk-themes";

describe("desk themes", () => {
  it("unlocks the three selectable themes", () => {
    expect(isUnlockedDeskTheme("slate")).toBe(true);
    expect(isUnlockedDeskTheme("warm")).toBe(true);
    expect(isUnlockedDeskTheme("classic")).toBe(true);
    expect(isUnlockedDeskTheme("studio")).toBe(false);
  });

  it("falls back to slate", () => {
    expect(normalizeDeskTheme(undefined)).toBe("slate");
    expect(normalizeDeskTheme("studio")).toBe("slate");
    expect(normalizeDeskTheme("warm")).toBe("warm");
  });
});