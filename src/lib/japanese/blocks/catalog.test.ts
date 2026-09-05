import { describe, expect, it } from "vitest";
import { getPlayableBlockNumbers } from "./index";
import {
  catalogEntriesForBlock,
  getJapaneseCatalog,
  groupRepeatedRomaji,
  summarizeJapaneseCatalog,
} from "./catalog";

describe("japanese word catalog", () => {
  const catalog = getJapaneseCatalog();
  const summary = summarizeJapaneseCatalog(catalog);
  const playable = getPlayableBlockNumbers();

  it("covers all playable blocks at 50 words each", () => {
    expect(summary.total).toBe(playable.length * 50);
    expect(summary.blockCount).toBe(playable.length);
    for (const n of playable) {
      expect(catalogEntriesForBlock(n, catalog)).toHaveLength(50);
    }
  });

  it("counts unique romaji vs repeated headwords", () => {
    expect(summary.uniqueRomaji).toBeGreaterThan(400);
    expect(summary.repeatedRomajiCount).toBeGreaterThan(0);
    expect(summary.repeatedRomajiSlots).toBeGreaterThan(summary.repeatedRomajiCount);
  });

  it("flags repeated romaji across blocks when present", () => {
    const groups = groupRepeatedRomaji(catalog);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]?.entries.length).toBeGreaterThanOrEqual(2);
  });

  it("marks same-sound different-word clashes for san when present", () => {
    const san = catalog.filter((entry) => entry.romajiKey === "san");
    if (san.length >= 2) {
      expect(san.every((entry) => entry.romajiClash)).toBe(true);
    }
  });
});
