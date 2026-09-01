import { describe, expect, it } from "vitest";
import type { JapaneseWord } from "./types";
import {
  buildPlayAudioDebug,
  getAudioText,
  hiraganaToKatakana,
  isLikelyRomaji,
} from "./word-helpers";

const shiru: JapaneseWord = {
  jp: "\u77e5\u308b",
  audio: "\u3057\u308b",
  r: "shiru",
  en: "know",
  m: "SURE",
};

const suki: JapaneseWord = {
  jp: "\u597d\u304d",
  audio: "\u3059\u304d",
  r: "suki",
  en: "like",
  m: "SOOKIE",
};

describe("getAudioText", () => {
  it("returns distinct kanji TTS hints for shiru and suki", () => {
    expect(getAudioText(shiru)).toBe("\u77e5\u308b");
    expect(getAudioText(suki)).toBe("\u597d\u304d");
    expect(getAudioText(shiru)).not.toBe(getAudioText(suki));
  });

  it("prefers kana tts override when set", () => {
    expect(getAudioText(suki, { ttsInput: "\u3059\u304d\u3060" })).toBe("\u30b9\u30ad\u30c0");
  });

  it("ignores romaji overrides and uses kanji hints", () => {
    expect(getAudioText(suki, { ttsInput: "shiru" })).toBe("\u597d\u304d");
    expect(getAudioText(shiru, { ttsInput: "suki" })).toBe("\u77e5\u308b");
  });
});

describe("hiraganaToKatakana", () => {
  it("converts hiragana syllables", () => {
    expect(hiraganaToKatakana("\u3059\u304d")).toBe("\u30b9\u30ad");
    expect(hiraganaToKatakana("\u3057\u308b")).toBe("\u30b7\u30eb");
  });
});

describe("isLikelyRomaji", () => {
  it("detects ascii romaji cues", () => {
    expect(isLikelyRomaji("shiru")).toBe(true);
    expect(isLikelyRomaji("\u3059\u304d")).toBe(false);
  });
});

describe("buildPlayAudioDebug", () => {
  it("includes correct finalAudio per word", () => {
    expect(buildPlayAudioDebug(shiru, 19).finalAudio).toBe("\u77e5\u308b");
    expect(buildPlayAudioDebug(suki, 34).finalAudio).toBe("\u597d\u304d");
  });
});