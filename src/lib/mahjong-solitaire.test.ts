import { describe, expect, it } from "vitest";
import {
  TEMPLE_LAYOUT,
  canMatch,
  isCovered,
  isFree,
  type SolitaireTile,
} from "@/lib/mahjong-solitaire";

function tile(
  partial: Partial<SolitaireTile> & Pick<SolitaireTile, "id" | "x" | "y" | "z">,
): SolitaireTile {
  return {
    pairId: 1,
    face: "word",
    label: "a",
    refLabel: "#0001",
    removed: false,
    ...partial,
  };
}

describe("mahjong solitaire free-tile rules", () => {
  it("deals the temple layout with 36 slots", () => {
    expect(TEMPLE_LAYOUT).toHaveLength(36);
    expect(TEMPLE_LAYOUT.filter((s) => s.z === 0)).toHaveLength(24);
    expect(TEMPLE_LAYOUT.filter((s) => s.z === 1)).toHaveLength(12);
  });

  it("treats a covered tile as not free", () => {
    const bottom = tile({ id: "b", x: 1, y: 1, z: 0 });
    const top = tile({ id: "t", x: 0.5, y: 0.5, z: 1 });
    const tiles = [bottom, top];
    expect(isCovered(bottom, tiles)).toBe(true);
    expect(isFree(bottom, tiles)).toBe(false);
    expect(isFree(top, tiles)).toBe(true);
  });

  it("allows edge tiles with one open side", () => {
    const left = tile({ id: "l", x: 0, y: 0, z: 0 });
    const mid = tile({ id: "m", x: 1, y: 0, z: 0 });
    const right = tile({ id: "r", x: 2, y: 0, z: 0 });
    const tiles = [left, mid, right];
    expect(isFree(left, tiles)).toBe(true);
    expect(isFree(right, tiles)).toBe(true);
    expect(isFree(mid, tiles)).toBe(false);
  });

  it("reopens a middle tile after a neighbor is removed", () => {
    const left = tile({ id: "l", x: 0, y: 0, z: 0, removed: true });
    const mid = tile({ id: "m", x: 1, y: 0, z: 0 });
    const right = tile({ id: "r", x: 2, y: 0, z: 0 });
    expect(isFree(mid, [left, mid, right])).toBe(true);
  });

  it("matches only English ↔ 中文 of the same rank", () => {
    const a = tile({ id: "1w", x: 0, y: 0, z: 0, pairId: 3, face: "word" });
    const b = tile({ id: "1z", x: 1, y: 0, z: 0, pairId: 3, face: "zh" });
    const c = tile({ id: "2w", x: 2, y: 0, z: 0, pairId: 4, face: "word" });
    expect(canMatch(a, b)).toBe(true);
    expect(canMatch(a, c)).toBe(false);
    expect(canMatch(a, { ...a, id: "dup", face: "word" })).toBe(false);
  });
});
