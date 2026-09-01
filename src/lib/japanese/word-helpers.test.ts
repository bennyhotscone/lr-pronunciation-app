import { describe, expect, it } from "vitest";
import type { JapaneseWord } from "./types";
import { buildPlayAudioDebug, getAudioText } from "./word-helpers";

const shiru: JapaneseWord = {
  jp: "知る",
  audio: "しる",
  r: "shiru",
  en: "know",
  m: "SURE",
};

const suki: JapaneseWord = {
  jp: "好き",
  audio: "すき",
  r: "suki",
  en: "like",
  m: "SOOKIE",
};

describe("getAudioText", () => {
  it("returns distinct default audio for shiru and suki", () => {
    expect(getAudioText(shiru)).toBe("しる");
    expect(getAudioText(suki)).toBe("すき");
    expect(getAudioText(shiru)).not.toBe(getAudioText(suki));
  });

  it("prefers tts override when set", () => {
    expect(getAudioText(suki, { ttsInput: "すきだ" })).toBe("すきだ");
  });
});

describe("buildPlayAudioDebug", () => {
  it("includes correct finalAudio per word", () => {
    expect(buildPlayAudioDebug(shiru, 19).finalAudio).toBe("しる");
    expect(buildPlayAudioDebug(suki, 34).finalAudio).toBe("すき");
  });
});