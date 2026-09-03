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
    expect(summary.uniqueRomaji).toBe(452);
    expect(summary.repeatedRomajiCount).toBe(45);
    expect(summary.repeatedRomajiSlots).toBe(93);
  });

  it("flags the worst repeats across blocks", () => {
    const groups = groupRepeatedRomaji(catalog);
    const byRomaji = Object.fromEntries(
      groups.map((group) => [group.romajiKey, group.entries.map((e) => e.blockNumber)]),
    );
    expect(byRomaji.mada).toEqual([2, 4]);
    expect(byRomaji.dareka).toEqual([5, 7]);
    expect(byRomaji.hito).toEqual([1, 3, 7]);
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
