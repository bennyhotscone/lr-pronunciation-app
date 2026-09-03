import { describe, expect, it } from "vitest";
import {
  catalogEntriesForBlock,
  getJapaneseCatalog,
  groupRepeatedRomaji,
  summarizeJapaneseCatalog,
} from "./catalog";

describe("japanese word catalog", () => {
  const catalog = getJapaneseCatalog();
  const summary = summarizeJapaneseCatalog(catalog);

  it("covers all 10 playable blocks at 50 words each", () => {
    expect(summary.total).toBe(500);
    expect(summary.blockCount).toBe(10);
    for (let n = 1; n <= 10; n++) {
      expect(catalogEntriesForBlock(n, catalog)).toHaveLength(50);
    }
  });

  it("counts unique romaji vs repeated headwords", () => {
    expect(summary.uniqueRomaji).toBe(431);
    expect(summary.repeatedRomajiCount).toBe(66);
    expect(summary.repeatedRomajiSlots).toBe(135);
  });

  it("flags the worst repeats across blocks", () => {
    const groups = groupRepeatedRomaji(catalog);
    const byRomaji = Object.fromEntries(
      groups.map((group) => [group.romajiKey, group.entries.map((e) => e.blockNumber)]),
    );
    expect(byRomaji.mada).toEqual([2, 4, 6]);
    expect(byRomaji.mou).toEqual([2, 7, 9]);
    expect(byRomaji.dareka).toEqual([5, 6, 8]);
    expect(groups[0]?.entries.length).toBe(3);
  });

  it("marks same-sound different-word clashes", () => {
    const san = catalog.filter((entry) => entry.romajiKey === "san");
    expect(san).toHaveLength(2);
    expect(san.every((entry) => entry.romajiClash)).toBe(true);
    expect(san.map((entry) => entry.word.en).sort()).toEqual([
      "Mr. / Ms. (honorific)",
      "three",
    ]);
  });
});
