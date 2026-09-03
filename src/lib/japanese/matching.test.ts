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

const kamoshirenai: JapaneseWord = {
  jp: "かもしれない",
  audio: "かもしれない",
  r: "kamoshirenai",
  en: "might",
  m: "test",
};

const sarani: JapaneseWord = {
  jp: "さらに",
  audio: "さらに",
  r: "sarani",
  en: "more / furthermore",
  m: "test",
};

describe("japanese matching", () => {
  it("accepts english aliases and fuzzy spelling", () => {
    expect(fuzzyMatchEnglish("me", watashi)).toBe(true);
    expect(fuzzyMatchEnglish("I", watashi)).toBe(true);
    expect(fuzzyMatchEnglish("  ME  ", watashi)).toBe(true);
  });

  it("accepts dad/father and mum/mom/mother family aliases", () => {
    const otousan: JapaneseWord = {
      jp: "お父さん",
      audio: "おとうさん",
      r: "otousan",
      en: "dad / father",
      m: "x",
    };
    const okaasan: JapaneseWord = {
      jp: "お母さん",
      audio: "おかあさん",
      r: "okaasan",
      en: "mother",
      m: "x",
    };
    expect(fuzzyMatchEnglish("dad", otousan)).toBe(true);
    expect(fuzzyMatchEnglish("father", otousan)).toBe(true);
    expect(fuzzyMatchEnglish("mum", okaasan)).toBe(true);
    expect(fuzzyMatchEnglish("mom", okaasan)).toBe(true);
    expect(fuzzyMatchEnglish("mother", okaasan)).toBe(true);
  });

  it("accepts fuck/shit/damn/crap for kuso and chikushou", () => {
    const kuso: JapaneseWord = {
      jp: "くそ",
      audio: "くそ",
      r: "kuso",
      en: "fuck / shit",
      m: "x",
    };
    const chikushou: JapaneseWord = {
      jp: "畜生",
      audio: "ちくしょう",
      r: "chikushou",
      en: "damn it / fuck",
      m: "x",
    };
    for (const ans of ["fuck", "shit", "damn", "crap"]) {
      expect(fuzzyMatchEnglish(ans, kuso)).toBe(true);
      expect(fuzzyMatchEnglish(ans, chikushou)).toBe(true);
    }
    expect(fuzzyMatchEnglish("damn it", chikushou)).toBe(true);
  });

  it("accepts sure for of course (mochiron)", () => {
    const mochiron: JapaneseWord = {
      jp: "もちろん",
      audio: "もちろん",
      r: "mochiron",
      en: "of course",
      m: "x",
    };
    expect(fuzzyMatchEnglish("of course", mochiron)).toBe(true);
    expect(fuzzyMatchEnglish("sure", mochiron)).toBe(true);
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

  it("accepts kamoshirenai as might (not maybe)", () => {
    expect(fuzzyMatchEnglish("might", kamoshirenai)).toBe(true);
    expect(fuzzyMatchEnglish("possibly", kamoshirenai)).toBe(true);
    expect(fuzzyMatchEnglish("maybe", kamoshirenai)).toBe(false);
    expect(fuzzyMatchRomaji("kamoshirenai", kamoshirenai)).toBe(true);
  });

  it("accepts sarani gloss synonyms and japanese forms", () => {
    expect(fuzzyMatchEnglish("furthermore", sarani)).toBe(true);
    expect(fuzzyMatchEnglish("moreover", sarani)).toBe(true);
    expect(fuzzyMatchEnglish("moreso", sarani)).toBe(true);
    expect(fuzzyMatchEnglish("more so", sarani)).toBe(true);
    expect(fuzzyMatchEnglish("sarani", sarani)).toBe(true);
    expect(fuzzyMatchEnglish("さらに", sarani)).toBe(true);
    expect(fuzzyMatchRomaji("sarani", sarani)).toBe(true);
  });

  it("accepts shitteru spoken forms and aliases legacy shiru", () => {
    const shitteru: JapaneseWord = {
      jp: "知ってる",
      audio: "しってる",
      r: "shitteru",
      en: "know",
      m: "x",
    };
    expect(fuzzyMatchEnglish("know", shitteru)).toBe(true);
    expect(fuzzyMatchRomaji("shitteru", shitteru)).toBe(true);
    expect(fuzzyMatchRomaji("shitteiru", shitteru)).toBe(true);
    expect(fuzzyMatchRomaji("shiru", shitteru)).toBe(true);
  });
});
