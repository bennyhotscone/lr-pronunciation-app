import { describe, expect, it } from "vitest";
import {
  getParticleAudioText,
  particleKanaForTts,
  resolveParticleAudioSource,
} from "./audio";
import { PARTICLE_VERBS } from "./verbs";

const HAS_KANJI_RE = /[\u4e00-\u9fff]/;

function spokenCore(text: string): string {
  return text.replace(/[\u30fb\u3002]/g, "");
}

describe("getParticleAudioText", () => {
  it("uses katakana from romaji for kanji verb forms", () => {
    expect(spokenCore(getParticleAudioText({ jp: "\u98df\u3079\u308b", romaji: "taberu" }))).toBe(
      "\u30bf\u30d9\u30eb",
    );
    expect(spokenCore(getParticleAudioText({ jp: "\u98df\u3079\u306a\u3044", romaji: "tabenai" }))).toBe(
      "\u30bf\u30d9\u30ca\u30a4",
    );
    expect(
      spokenCore(getParticleAudioText({ jp: "\u6c34\u3092\u98f2\u3080", romaji: "mizu o nomu" })),
    ).toBe("\u30df\u30ba\u30aa\u30ce\u30e0");
  });

  it("resolves known verb romaji when jp is ascii", () => {
    expect(spokenCore(getParticleAudioText({ jp: "taberu", romaji: "taberu" }))).toBe(
      "\u30bf\u30d9\u30eb",
    );
  });

  it("rejects sources with no usable japanese", () => {
    expect(getParticleAudioText({ jp: "", romaji: "" })).toBe("");
    expect(getParticleAudioText({ jp: "mizu o nomu", romaji: "" })).toBe("");
  });

  it("never speaks kanji for mita — must be MITA kana, not MAMA", () => {
    const miru = PARTICLE_VERBS.find((v) => v.base === "miru");
    const mita = miru?.forms.find((f) => f.romaji === "mita");
    expect(mita).toBeTruthy();

    const spoken = getParticleAudioText({
      jp: mita!.jp,
      romaji: mita!.romaji,
      en: mita!.meaning,
    });
    const core = spokenCore(spoken);

    expect(core).toBe("\u30df\u30bf");
    expect(spoken).toContain("\u30df");
    expect(spoken).toContain("\u30bf");
    expect(spoken).not.toContain("\u30de");
    expect(spoken).not.toContain("\u30de\u30de");
    expect(spoken).not.toContain("\u898b");
    expect(core).not.toBe("\u30de\u30de");
  });

  it("keeps short past/common forms as clear kana (not mama-like)", () => {
    const cases: Array<{ romaji: string; kana: string }> = [
      { romaji: "mita", kana: "\u30df\u30bf" },
      { romaji: "tabeta", kana: "\u30bf\u30d9\u30bf" },
      { romaji: "kita", kana: "\u30ad\u30bf" },
      { romaji: "shita", kana: "\u30b7\u30bf" },
      { romaji: "itta", kana: "\u30a4\u30c3\u30bf" },
      { romaji: "miru", kana: "\u30df\u30eb" },
      { romaji: "minai", kana: "\u30df\u30ca\u30a4" },
    ];

    for (const { romaji, kana } of cases) {
      const spoken = getParticleAudioText({ jp: "x", romaji });
      expect(spokenCore(spoken), romaji).toBe(kana);
      expect(spoken, romaji).not.toContain("\u30de\u30de");
      expect(spoken, romaji).not.toMatch(HAS_KANJI_RE);
    }
  });

  it("rejects kanji-only jp without romaji instead of emitting mixed kanji", () => {
    expect(getParticleAudioText({ jp: "\u898b\u305f", romaji: "" })).toBe("");
    expect(getParticleAudioText({ jp: "\u98df\u3079\u305f", romaji: "" })).toBe("");
  });
});

describe("particleKanaForTts", () => {
  it("separates short mora so Web Speech cannot blur MITA into mama", () => {
    expect(particleKanaForTts("\u30df\u30bf")).toBe("\u30df\u30fb\u30bf\u3002");
  });
});

describe("resolveParticleAudioSource", () => {
  it("uses canonical jp from verbs.ts for tabenai", () => {
    const resolved = resolveParticleAudioSource({ jp: "wrong", romaji: "tabenai", en: "x" });
    expect(resolved.jp).toBe("\u98df\u3079\u306a\u3044");
    expect(resolved.romaji).toBe("tabenai");
    expect(spokenCore(getParticleAudioText(resolved))).toBe("\u30bf\u30d9\u30ca\u30a4");
  });

  it("uses canonical mita jp/romaji from verbs.ts", () => {
    const resolved = resolveParticleAudioSource({
      jp: "wrong",
      romaji: "mita",
      en: "x",
    });
    expect(resolved.jp).toBe("\u898b\u305f");
    expect(resolved.romaji).toBe("mita");
    expect(spokenCore(getParticleAudioText(resolved))).toBe("\u30df\u30bf");
  });
});
