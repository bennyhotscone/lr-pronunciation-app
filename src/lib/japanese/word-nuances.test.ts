import { describe, expect, it } from "vitest";
import { findDuplicateGlossGroups } from "./duplicate-gloss";
import {
  getDetectedDuplicateGlossGroups,
  getNuanceForWord,
  getNuanceGroupForWord,
  wordHasNuanceExplanation,
  wordsShareNuanceGroup,
  WORD_NUANCE_GROUPS,
} from "./word-nuances";
import type { JapaneseWord } from "./types";

const tabun: JapaneseWord = {
  jp: "多分",
  audio: "たぶん",
  r: "tabun",
  en: "probably / maybe",
  m: "test",
};

const kamo: JapaneseWord = {
  jp: "かもしれない",
  audio: "かもしれない",
  r: "kamoshirenai",
  en: "maybe",
  m: "test",
};

const korera: JapaneseWord = {
  jp: "これら",
  audio: "これら",
  r: "korera",
  en: "these",
  m: "test",
};

const hoka: JapaneseWord = {
  jp: "他",
  audio: "ほか",
  r: "hoka",
  en: "other",
  m: "test",
};

const tazuneru: JapaneseWord = {
  jp: "尋ねる",
  audio: "たずねる",
  r: "tazuneru",
  en: "ask",
  m: "test",
};

describe("duplicate gloss detection", () => {
  it("finds duplicate gloss groups across blocks 1-3", () => {
    const groups = findDuplicateGlossGroups();
    expect(groups.length).toBeGreaterThanOrEqual(6);
    const tokens = new Set(groups.map((g) => g.token));
    for (const expected of ["also", "ask", "maybe", "more", "sorry", "work"]) {
      expect(tokens.has(expected)).toBe(true);
    }
  });
});

describe("word nuances", () => {
  it("loads curated distinction groups from JSON", () => {
    expect(WORD_NUANCE_GROUPS.length).toBeGreaterThanOrEqual(12);
    expect(getDetectedDuplicateGlossGroups().length).toBeGreaterThanOrEqual(6);
  });

  it("returns nuance for maybe pair", () => {
    expect(getNuanceForWord(tabun)?.when).toMatch(/best guess/i);
    expect(getNuanceForWord(kamo)?.when).toMatch(/uncertainty|might/i);
    expect(getNuanceGroupForWord(tabun)?.id).toBe("uncertainty-maybe");
    expect(getNuanceGroupForWord(kamo)?.id).toBe("uncertainty-maybe");
  });

  it("returns nuance for block 3 words: korera, hoka, tazuneru, kamoshirenai", () => {
    expect(wordHasNuanceExplanation(korera)).toBe(true);
    expect(wordHasNuanceExplanation(hoka)).toBe(true);
    expect(wordHasNuanceExplanation(tazuneru)).toBe(true);
    expect(wordHasNuanceExplanation(kamo)).toBe(true);
    expect(getNuanceGroupForWord(korera)?.id).toBe("demonstratives-ko");
    expect(getNuanceGroupForWord(hoka)?.id).toBe("other-distinction");
  });

  it("detects shared nuance groups", () => {
    expect(wordsShareNuanceGroup("tabun", "kamoshirenai")).toBe(true);
    expect(wordsShareNuanceGroup("tabun", "koko")).toBe(false);
  });

  it("prefers per-word nuance field when set", () => {
    const custom: JapaneseWord = { ...tabun, nuance: "Custom override." };
    expect(getNuanceForWord(custom)?.when).toBe("Custom override.");
  });
});
