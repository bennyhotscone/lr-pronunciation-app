import { describe, expect, it } from "vitest";
import { getParticleAudioText, resolveParticleAudioSource } from "./audio";

describe("getParticleAudioText", () => {
  it("converts jp script to katakana TTS input", () => {
    expect(getParticleAudioText({ jp: "\u98df\u3079\u308b", romaji: "taberu" })).toBe(
      "\u98df\u30d9\u30eb",
    );
    expect(getParticleAudioText({ jp: "\u98df\u3079\u306a\u3044", romaji: "tabenai" })).toBe(
      "\u98df\u30d9\u30ca\u30a4",
    );
    expect(getParticleAudioText({ jp: "\u6c34\u3092\u98f2\u3080", romaji: "mizu o nomu" })).toBe(
      "\u6c34\u30f2\u98f2\u30e0",
    );
  });

  it("resolves known verb romaji when jp is ascii", () => {
    expect(getParticleAudioText({ jp: "taberu", romaji: "taberu" })).toBe("\u98df\u30d9\u30eb");
  });

  it("rejects unknown ascii-only jp", () => {
    expect(getParticleAudioText({ jp: "mizu o nomu", romaji: "mizu o nomu" })).toBe("");
    expect(getParticleAudioText({ jp: "", romaji: "" })).toBe("");
  });
});

describe("resolveParticleAudioSource", () => {
  it("uses canonical jp from verbs.ts for tabenai", () => {
    const resolved = resolveParticleAudioSource({ jp: "wrong", romaji: "tabenai", en: "x" });
    expect(resolved.jp).toBe("\u98df\u3079\u306a\u3044");
    expect(resolved.romaji).toBe("tabenai");
    expect(getParticleAudioText(resolved)).toBe("\u98df\u30d9\u30ca\u30a4");
  });
});