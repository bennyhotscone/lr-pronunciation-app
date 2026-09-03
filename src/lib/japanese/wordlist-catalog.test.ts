import { describe, expect, it } from "vitest";
import {
  countWordlist,
  isWordlistEntryKnown,
  matchesKnownFilter,
  mergeKnownKeys,
  wordlistKnownKey,
} from "./wordlist-catalog";

describe("wordlist known filters", () => {
  const rows = [
    { blockNumber: 1, wordIndex: 0 },
    { blockNumber: 1, wordIndex: 1 },
    { blockNumber: 1, wordIndex: 2 },
    { blockNumber: 2, wordIndex: 0 },
    { blockNumber: 2, wordIndex: 1 },
  ];

  it("keys known flags by block and word index", () => {
    expect(wordlistKnownKey(3, 9)).toBe("3:9");
  });

  it("counts known vs unknown from merged stats", () => {
    const knownKeys = mergeKnownKeys(["1:0", "2:0"], 1, 3, {
      0: { known: true },
      2: { known: false },
    });
    const thisBlock = rows.filter((row) => row.blockNumber === 1);
    expect(countWordlist(thisBlock, knownKeys)).toEqual({ known: 1, unknown: 2, total: 3 });
    expect(countWordlist(rows, knownKeys)).toEqual({ known: 2, unknown: 3, total: 5 });
    expect(isWordlistEntryKnown(rows[3], knownKeys)).toBe(true);
  });

  it("lets live block stats demote a fetched known flag", () => {
    const knownKeys = mergeKnownKeys(["1:0"], 1, 3, { 0: { known: false } });
    expect(knownKeys.has("1:0")).toBe(false);
  });

  it("filters all / known / unknown", () => {
    const knownKeys = new Set(["1:0", "2:1"]);
    expect(rows.filter((row) => matchesKnownFilter(row, "all", knownKeys))).toHaveLength(5);
    expect(
      rows
        .filter((row) => matchesKnownFilter(row, "known", knownKeys))
        .map((row) => wordlistKnownKey(row.blockNumber, row.wordIndex)),
    ).toEqual(["1:0", "2:1"]);
    expect(
      rows
        .filter((row) => matchesKnownFilter(row, "unknown", knownKeys))
        .map((row) => wordlistKnownKey(row.blockNumber, row.wordIndex)),
    ).toEqual(["1:1", "1:2", "2:0"]);
  });
});
