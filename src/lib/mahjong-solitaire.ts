/**
 * Mahjong Solitaire layout + classic free-tile rules.
 * Free = not covered from above AND (left edge open OR right edge open).
 */

export type LayoutSlot = {
  x: number;
  y: number;
  z: number;
};

/** Compact “Temple” layout — 36 tiles (18 pairs), mobile-friendly. */
export const TEMPLE_LAYOUT: LayoutSlot[] = (() => {
  const slots: LayoutSlot[] = [];
  // Base layer: 4 × 6
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 6; x++) {
      slots.push({ x, y, z: 0 });
    }
  }
  // Raised layer: 3 × 4, centered half-steps so each tile covers a 2×2 below
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      slots.push({ x: col + 0.5, y: row + 0.5, z: 1 });
    }
  }
  return slots;
})();

export const LAYOUT_PAIR_COUNT = TEMPLE_LAYOUT.length / 2; // 18

export type TileFace = "word" | "zh";

export type SolitaireTile = {
  id: string;
  pairId: number;
  face: TileFace;
  label: string;
  refLabel: string;
  x: number;
  y: number;
  z: number;
  removed: boolean;
};

const EPS = 0.001;

function overlapsXY(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < 1 - EPS && Math.abs(a.y - b.y) < 1 - EPS;
}

export function isCovered(tile: SolitaireTile, tiles: SolitaireTile[]): boolean {
  if (tile.removed) return false;
  return tiles.some(
    (t) =>
      !t.removed &&
      t.id !== tile.id &&
      t.z > tile.z &&
      overlapsXY(t, tile),
  );
}

function hasSideNeighbor(
  tile: SolitaireTile,
  tiles: SolitaireTile[],
  side: -1 | 1,
): boolean {
  return tiles.some(
    (t) =>
      !t.removed &&
      t.id !== tile.id &&
      t.z === tile.z &&
      Math.abs(t.y - tile.y) < 1 - EPS &&
      Math.abs(t.x - (tile.x + side)) < EPS,
  );
}

/** Classic Mahjong Solitaire: uncovered and free on left or right. */
export function isFree(tile: SolitaireTile, tiles: SolitaireTile[]): boolean {
  if (tile.removed) return false;
  if (isCovered(tile, tiles)) return false;
  const leftOpen = !hasSideNeighbor(tile, tiles, -1);
  const rightOpen = !hasSideNeighbor(tile, tiles, 1);
  return leftOpen || rightOpen;
}

export function canMatch(a: SolitaireTile, b: SolitaireTile): boolean {
  return a.pairId === b.pairId && a.face !== b.face && a.id !== b.id;
}

export function shuffleSlots<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Board extents for CSS positioning (include raised-layer half-steps). */
export const LAYOUT_BOUNDS = {
  minX: 0,
  maxX: 5,
  minY: 0,
  maxY: 3.5,
  maxZ: 1,
};
