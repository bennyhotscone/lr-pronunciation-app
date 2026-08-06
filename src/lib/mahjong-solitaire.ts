/**
 * Mahjong Solitaire layout + classic free-tile rules.
 * Free = not covered from above AND (left edge open OR right edge open).
 */

export type LayoutSlot = {
  x: number;
  y: number;
  z: number;
};

export const MAX_TILES = 100;
export const MAX_PAIRS = 50;

function grid(
  cols: number,
  rows: number,
  z: number,
  ox = 0,
  oy = 0,
): LayoutSlot[] {
  const slots: LayoutSlot[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      slots.push({ x: x + ox, y: y + oy, z });
    }
  }
  return slots;
}

function boundsOf(slots: LayoutSlot[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxZ = 0;
  for (const s of slots) {
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minY = Math.min(minY, s.y);
    maxY = Math.max(maxY, s.y);
    maxZ = Math.max(maxZ, s.z);
  }
  return { minX, maxX, minY, maxY, maxZ };
}

/** Compact temple — 36 tiles (18 pairs). Fallback when audio pool is tiny. */
export const TEMPLE_LAYOUT: LayoutSlot[] = [
  ...grid(6, 4, 0),
  ...grid(4, 3, 1, 0.5, 0.5),
];

/** Fortress — 72 tiles (36 pairs). Solid mobile-friendly mid board. */
export const FORTRESS_LAYOUT: LayoutSlot[] = [
  ...grid(8, 5, 0),
  ...grid(6, 4, 1, 1, 0.5),
  ...grid(4, 2, 2, 2, 1.5),
];

/** Palace — 80 tiles (40 pairs). */
export const PALACE_LAYOUT: LayoutSlot[] = [
  ...grid(8, 6, 0),
  ...grid(6, 4, 1, 1, 1),
  ...grid(4, 2, 2, 2, 2),
];

/** Great Wall — 96 tiles (48 pairs). Preferred when enough vocabulary. */
export const GREAT_WALL_LAYOUT: LayoutSlot[] = [
  ...grid(8, 6, 0),
  ...grid(6, 5, 1, 1, 0.5),
  ...grid(4, 3, 2, 2, 1.5),
  ...grid(2, 3, 3, 3, 1.5),
];

const LAYOUT_LADDER: LayoutSlot[][] = [
  GREAT_WALL_LAYOUT,
  PALACE_LAYOUT,
  FORTRESS_LAYOUT,
  TEMPLE_LAYOUT,
];

export type TileFace = "word" | "zh" | "audio";

export type SolitaireTile = {
  id: string;
  pairId: number;
  face: TileFace;
  label: string;
  refLabel: string;
  /** Present on audio-face tiles. */
  audioFile?: string;
  x: number;
  y: number;
  z: number;
  removed: boolean;
};

export type LayoutInfo = {
  slots: LayoutSlot[];
  bounds: ReturnType<typeof boundsOf>;
  pairCount: number;
};

/** Largest even layout that fits availablePairs (≤50). */
export function pickLayout(availablePairs: number): LayoutInfo {
  const capped = Math.min(Math.max(0, availablePairs), MAX_PAIRS);
  for (const slots of LAYOUT_LADDER) {
    const pairCount = slots.length / 2;
    if (pairCount <= capped && slots.length <= MAX_TILES) {
      return { slots, bounds: boundsOf(slots), pairCount };
    }
  }
  // Extreme shortfall: take first N*2 slots of temple (must be even).
  const n = Math.max(2, Math.floor(capped));
  const slots = TEMPLE_LAYOUT.slice(0, n * 2);
  return { slots, bounds: boundsOf(slots), pairCount: slots.length / 2 };
}

/** @deprecated Prefer pickLayout — kept for older tests / imports. */
export const LAYOUT_PAIR_COUNT = TEMPLE_LAYOUT.length / 2;

/** @deprecated Prefer pickLayout().bounds */
export const LAYOUT_BOUNDS = boundsOf(TEMPLE_LAYOUT);

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

/**
 * Same-layer side contact: Y footprints overlap and the neighbor’s X
 * abuts this tile on the given side (unit grid, including 0.5 offsets).
 * Using an abutment band (not only exact x±1) keeps half-step layouts honest.
 */
function hasSideNeighbor(
  tile: SolitaireTile,
  tiles: SolitaireTile[],
  side: -1 | 1,
): boolean {
  return tiles.some((t) => {
    if (t.removed || t.id === tile.id || t.z !== tile.z) return false;
    // Footprint is 1×1; require meaningful vertical overlap.
    if (Math.abs(t.y - tile.y) >= 1 - EPS) return false;
    // Neighbor must sit immediately to the left (−1) or right (+1).
    const expected = tile.x + side;
    return Math.abs(t.x - expected) < 0.5 - EPS;
  });
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

/** Free opposite-face tiles that match the selected tile (same rank). */
export function freeMatchingPartnerIds(
  selected: SolitaireTile | undefined,
  tiles: SolitaireTile[],
): Set<string> {
  const ids = new Set<string>();
  if (!selected || selected.removed) return ids;
  for (const t of tiles) {
    if (!t.removed && isFree(t, tiles) && canMatch(selected, t)) {
      ids.add(t.id);
    }
  }
  return ids;
}

/** True when at least one free opposite-face pair of the same rank exists. */
export function hasValidMove(tiles: SolitaireTile[]): boolean {
  const free = tiles.filter((t) => isFree(t, tiles));
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (canMatch(free[i]!, free[j]!)) return true;
    }
  }
  return false;
}

export function freeTileIds(tiles: SolitaireTile[]): Set<string> {
  const set = new Set<string>();
  for (const t of tiles) {
    if (isFree(t, tiles)) set.add(t.id);
  }
  return set;
}

export function shuffleSlots<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export type FaceSpec = Omit<SolitaireTile, "x" | "y" | "z" | "removed">;

/** Place face specs onto shuffled layout slots. */
export function placeOnLayout(
  faces: FaceSpec[],
  slots: LayoutSlot[],
): SolitaireTile[] {
  const shuffledFaces = shuffleSlots(faces);
  const shuffledSlots = shuffleSlots([...slots]);
  if (shuffledFaces.length !== shuffledSlots.length) {
    throw new Error(
      `placeOnLayout: ${shuffledFaces.length} faces vs ${shuffledSlots.length} slots`,
    );
  }
  return shuffledFaces.map((face, i) => {
    const slot = shuffledSlots[i]!;
    return {
      ...face,
      x: slot.x,
      y: slot.y,
      z: slot.z,
      removed: false,
    };
  });
}

/**
 * Reshuffle remaining (unremoved) tiles onto the same slot set.
 * Keeps which ranks/faces are left; unlocks new free combos.
 */
export function remixRemaining(tiles: SolitaireTile[]): SolitaireTile[] {
  const remaining = tiles.filter((t) => !t.removed);
  if (remaining.length < 2) return tiles;
  const slots = remaining.map((t) => ({ x: t.x, y: t.y, z: t.z }));
  const faces: FaceSpec[] = remaining.map(
    ({ id, pairId, face, label, refLabel, audioFile }) => ({
      id,
      pairId,
      face,
      label,
      refLabel,
      ...(audioFile ? { audioFile } : {}),
    }),
  );
  const placed = placeOnLayout(faces, slots);
  const byId = new Map(placed.map((t) => [t.id, t]));
  return tiles.map((t) => (t.removed ? t : byId.get(t.id) ?? t));
}
