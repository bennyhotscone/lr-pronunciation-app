import { describe, expect, it } from "vitest";
import type { JapaneseWord } from "./types";
import {
  buildPlayAudioDebug,
  getAudioText,
  hiraganaToKatakana,
  isLikelyRomaji,
} from "./word-helpers";

const shitteru: JapaneseWord = {
  jp: "\u77e5\u3063\u3066\u308b",
  audio: "\u3057\u3063\u3066\u308b",
  r: "shitteru",
  en: "know",
  m: "SHIT TERU",
};

const suki: JapaneseWord = {
  jp: "\u597d\u304d",
  audio: "\u3059\u304d",
  r: "suki",
  en: "like",
  m: "SOOKIE",
};

describe("getAudioText", () => {
  it("returns distinct kanji TTS hints for shitteru and suki", () => {
    expect(getAudioText(shitteru)).toBe("\u77e5\u3063\u3066\u308b");
    expect(getAudioText(suki)).toBe("\u597d\u304d");
    expect(getAudioText(shitteru)).not.toBe(getAudioText(suki));
  });

  it("prefers kana tts override when set", () => {
    expect(getAudioText(suki, { ttsInput: "\u3059\u304d\u3060" })).toBe("\u30b9\u30ad\u30c0");
  });

  it("ignores romaji overrides and uses kanji hints", () => {
    expect(getAudioText(suki, { ttsInput: "shitteru" })).toBe("\u597d\u304d");
    expect(getAudioText(shitteru, { ttsInput: "suki" })).toBe("\u77e5\u3063\u3066\u308b");
  });
});

describe("hiraganaToKatakana", () => {
  it("converts hiragana syllables", () => {
    expect(hiraganaToKatakana("\u3059\u304d")).toBe("\u30b9\u30ad");
    expect(hiraganaToKatakana("\u3057\u3063\u3066\u308b")).toBe("\u30b7\u30c3\u30c6\u30eb");
  });
});

describe("isLikelyRomaji", () => {
  it("detects ascii romaji cues", () => {
    expect(isLikelyRomaji("shitteru")).toBe(true);
    expect(isLikelyRomaji("\u3059\u304d")).toBe(false);
  });
});

describe("buildPlayAudioDebug", () => {
  it("includes correct finalAudio per word", () => {
    expect(buildPlayAudioDebug(shitteru, 19).finalAudio).toBe("\u77e5\u3063\u3066\u308b");
    expect(buildPlayAudioDebug(suki, 34).finalAudio).toBe("\u597d\u304d");
  });
});
