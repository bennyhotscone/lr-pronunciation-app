import { describe, expect, it } from "vitest";
import { getParticleAudioText } from "./audio";

describe("getParticleAudioText", () => {
  it("converts jp script to katakana TTS input", () => {
    expect(getParticleAudioText({ jp: "\u98df\u3079\u308b", romaji: "taberu" })).toBe(
      "\u98df\u30d9\u30eb",
    );
    expect(getParticleAudioText({ jp: "\u6c34\u3092\u98f2\u3080", romaji: "mizu o nomu" })).toBe(
      "\u6c34\u30f2\u98f2\u30e0",
    );
  });

  it("rejects romaji so SpeechSynthesis never reads ascii", () => {
    expect(getParticleAudioText({ jp: "taberu", romaji: "taberu" })).toBe("");
    expect(getParticleAudioText({ jp: "mizu o nomu", romaji: "mizu o nomu" })).toBe("");
  });
});