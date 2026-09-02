import { describe, expect, it } from "vitest";
import {
  fuzzyMatchEnglish,
  fuzzyMatchEnglishText,
  fuzzyMatchRomaji,
} from "@/lib/japanese/matching";
import type { JapaneseWord } from "@/lib/japanese/types";

const watashi: JapaneseWord = {
  jp: "私",
  audio: "わたし",
  r: "watashi",
  en: "I / me",
  m: "test",
};

const mise: JapaneseWord = {
  jp: "店",
  audio: "みせ",
  r: "mise",
  en: "shop / store",
  m: "test",
};

const mada: JapaneseWord = {
  jp: "まだ",
  audio: "まだ",
  r: "mada",
  en: "still / not yet",
  m: "test",
};

const iku: JapaneseWord = {
  jp: "行く",
  audio: "いく",
  r: "iku",
  en: "go",
  m: "test",
};

describe("japanese matching", () => {
  it("accepts english aliases and fuzzy spelling", () => {
    expect(fuzzyMatchEnglish("me", watashi)).toBe(true);
    expect(fuzzyMatchEnglish("I", watashi)).toBe(true);
    expect(fuzzyMatchEnglish("  ME  ", watashi)).toBe(true);
  });

  it("accepts romaji with long-vowel shortcuts", () => {
    expect(fuzzyMatchRomaji("iku", iku)).toBe(true);
  });

  it("rejects empty answers", () => {
    expect(fuzzyMatchEnglish("", watashi)).toBe(false);
    expect(fuzzyMatchRomaji("   ", watashi)).toBe(false);
  });

  it("distinguishes mou (already) from mata (again)", () => {
    const mou: JapaneseWord = {
      jp: "もう",
      audio: "もう",
      r: "mou",
      en: "already / anymore",
      m: "x",
    };
    const mata: JapaneseWord = {
      jp: "また",
      audio: "また",
      r: "mata",
      en: "again / also",
      m: "x",
    };
    expect(fuzzyMatchEnglish("already", mou)).toBe(true);
    expect(fuzzyMatchEnglish("anymore", mou)).toBe(true);
    expect(fuzzyMatchEnglish("again", mou)).toBe(false);
    expect(fuzzyMatchEnglish("again", mata)).toBe(true);
    expect(fuzzyMatchEnglish("also", mata)).toBe(true);
    expect(fuzzyMatchEnglish("already", mata)).toBe(false);
  });

  it("accepts milestone comprehension synonyms and fluff", () => {
    expect(fuzzyMatchEnglishText("store", "shop", mise)).toBe(true);
    expect(fuzzyMatchEnglishText("the shop", "shop", mise)).toBe(true);
    expect(fuzzyMatchEnglishText("not yet", "still", mada)).toBe(true);
    expect(fuzzyMatchEnglishText("to go", "go", iku)).toBe(true);
  });
});
