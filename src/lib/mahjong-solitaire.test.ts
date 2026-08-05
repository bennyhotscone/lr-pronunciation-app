import { describe, expect, it } from "vitest";
import {
  TEMPLE_LAYOUT,
  FORTRESS_LAYOUT,
  GREAT_WALL_LAYOUT,
  canMatch,
  hasValidMove,
  isCovered,
  isFree,
  pickLayout,
  remixRemaining,
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
  it("offers layouts from 36 up to 96 tiles (≤100)", () => {
    expect(TEMPLE_LAYOUT).toHaveLength(36);
    expect(FORTRESS_LAYOUT).toHaveLength(72);
    expect(GREAT_WALL_LAYOUT).toHaveLength(96);
    expect(GREAT_WALL_LAYOUT.length).toBeLessThanOrEqual(100);
    expect(pickLayout(50).pairCount).toBe(48);
    expect(pickLayout(40).pairCount).toBe(40);
    expect(pickLayout(20).pairCount).toBe(18);
    expect(pickLayout(10).pairCount).toBe(10);
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

  it("free-tile rules work on half-offset same-layer rows", () => {
    // Typical layer-1 grid: ox/oy = 0.5 — adjacent pair should both be free.
    const a = tile({ id: "a", x: 1.5, y: 0.5, z: 1, pairId: 42, face: "word" });
    const b = tile({ id: "b", x: 2.5, y: 0.5, z: 1, pairId: 42, face: "zh" });
    const tiles = [a, b];
    expect(isFree(a, tiles)).toBe(true);
    expect(isFree(b, tiles)).toBe(true);
    expect(canMatch(a, b)).toBe(true);
    expect(hasValidMove(tiles)).toBe(true);

    // Three-in-a-row on half grid: ends free, middle locked.
    const left = tile({ id: "l", x: 0.5, y: 1.5, z: 1 });
    const mid = tile({ id: "m", x: 1.5, y: 1.5, z: 1 });
    const right = tile({ id: "r", x: 2.5, y: 1.5, z: 1 });
    expect(isFree(left, [left, mid, right])).toBe(true);
    expect(isFree(right, [left, mid, right])).toBe(true);
    expect(isFree(mid, [left, mid, right])).toBe(false);
  });

  it("reopens a middle tile after a neighbor is removed", () => {
    const left = tile({ id: "l", x: 0, y: 0, z: 0, removed: true });
    const mid = tile({ id: "m", x: 1, y: 0, z: 0 });
    const right = tile({ id: "r", x: 2, y: 0, z: 0 });
    expect(isFree(mid, [left, mid, right])).toBe(true);
  });

  it("matches opposite faces of the same rank (EN↔ZH or Audio↔ZH)", () => {
    const a = tile({ id: "1w", x: 0, y: 0, z: 0, pairId: 3, face: "word" });
    const b = tile({ id: "1z", x: 1, y: 0, z: 0, pairId: 3, face: "zh" });
    const c = tile({ id: "2w", x: 2, y: 0, z: 0, pairId: 4, face: "word" });
    const d = tile({
      id: "1a",
      x: 3,
      y: 0,
      z: 0,
      pairId: 3,
      face: "audio",
      label: "▶",
    });
    expect(canMatch(a, b)).toBe(true);
    expect(canMatch(d, b)).toBe(true);
    expect(canMatch(a, c)).toBe(false);
    expect(canMatch(a, { ...a, id: "dup", face: "word" })).toBe(false);
  });

  it("detects when no valid free pairs remain", () => {
    // Two free ends, wrong faces (both EN) → stuck
    const a = tile({ id: "a", x: 0, y: 0, z: 0, pairId: 1, face: "word" });
    const b = tile({ id: "b", x: 1, y: 0, z: 0, pairId: 1, face: "zh" });
    const c = tile({ id: "c", x: 2, y: 0, z: 0, pairId: 2, face: "word" });
    // mid blocks sides: free are a and c (same face family, different ranks)
    expect(hasValidMove([a, b, c])).toBe(false);
    // after removing mid, a+b can match
    expect(hasValidMove([a, { ...b, removed: true }, c])).toBe(false);
    const open = [
      tile({ id: "w", x: 0, y: 0, z: 0, pairId: 5, face: "word" }),
      tile({ id: "z", x: 2, y: 0, z: 0, pairId: 5, face: "zh" }),
    ];
    expect(hasValidMove(open)).toBe(true);
  });

  it("remix keeps remaining faces and slot count", () => {
    const tiles = [
      tile({ id: "1w", x: 0, y: 0, z: 0, pairId: 1, face: "word" }),
      tile({ id: "1z", x: 1, y: 0, z: 0, pairId: 1, face: "zh" }),
      tile({
        id: "2w",
        x: 2,
        y: 0,
        z: 0,
        pairId: 2,
        face: "word",
        removed: true,
      }),
      tile({
        id: "2z",
        x: 3,
        y: 0,
        z: 0,
        pairId: 2,
        face: "zh",
        removed: true,
      }),
    ];
    const next = remixRemaining(tiles);
    expect(next.filter((t) => !t.removed)).toHaveLength(2);
    expect(next.filter((t) => t.removed)).toHaveLength(2);
    const faces = next
      .filter((t) => !t.removed)
      .map((t) => `${t.pairId}:${t.face}`)
      .sort();
    expect(faces).toEqual(["1:word", "1:zh"]);
  });
});
