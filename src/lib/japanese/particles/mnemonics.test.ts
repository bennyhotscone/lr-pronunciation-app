import { describe, expect, it } from "vitest";
import {
  formatEndingMnemonicLine,
  formatEndingMnemonicShort,
  getVerbEndingMnemonic,
  getVerbGroupForFamily,
  VERB_GROUP_LIST,
  VERB_ENDING_MNEMONICS,
} from "./mnemonics";

describe("verb ending mnemonics", () => {
  it("maps nai to nope with options", () => {
    const m = getVerbEndingMnemonic("nai");
    expect(m?.sound).toMatch(/nope/i);
    expect(m?.meaning).toMatch(/don'?t/i);
    expect(m?.options.length).toBeGreaterThanOrEqual(2);
    expect(formatEndingMnemonicShort("nai")).toBeTruthy();
  });

  it("maps katta romaji to cutter options", () => {
    expect(getVerbEndingMnemonic(undefined, "tabekatta")?.sound).toMatch(/cutter/i);
    expect(formatEndingMnemonicLine("katta", "tabekatta")).toMatch(/cutter/i);
    expect(getVerbEndingMnemonic("katta")?.options.length).toBeGreaterThanOrEqual(2);
  });

  it("maps shita and nda", () => {
    expect(getVerbEndingMnemonic(undefined, "shita")?.sound).toBeTruthy();
    expect(getVerbEndingMnemonic(undefined, "nonda")?.sound).toBeTruthy();
  });

  it("covers desire negatives with plain English", () => {
    expect(getVerbEndingMnemonic("takunakatta")?.meaning).toMatch(/didn'?t want to/i);
    expect(getVerbEndingMnemonic("itakunakatta", "ikitakunakatta")?.meaning).toMatch(/didn'?t want to/i);
    expect(getVerbEndingMnemonic("takunai")?.meaning).toMatch(/don'?t want to/i);
    expect(getVerbEndingMnemonic("nakatta")?.meaning).toMatch(/didn'?t/i);
  });

  it("every teach ending has meaning + options", () => {
    const keys = [
      "ru", "u", "nai", "anai", "ta", "da", "nakatta", "anakatta",
      "tai", "itai", "takunai", "itakunai", "takatta", "itakatta",
      "takunakatta", "itakunakatta", "teru", "deru", "rareru", "eru",
      "dekiru", "you", "ou", "suru", "kuru",
    ];
    for (const key of keys) {
      const m = VERB_ENDING_MNEMONICS[key];
      expect(m, key).toBeTruthy();
      expect(m.meaning.length).toBeGreaterThan(3);
      expect(m.options.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("verb groups", () => {
  it("explains three patterns without jargon labels as titles", () => {
    expect(VERB_GROUP_LIST).toHaveLength(3);
    for (const g of VERB_GROUP_LIST) {
      expect(g.explain.length).toBeGreaterThan(20);
      expect(g.mnemonic.length).toBeGreaterThan(5);
      expect(g.title.toLowerCase()).not.toMatch(/ichidan|godan/);
    }
  });

  it("maps verb families to groups", () => {
    expect(getVerbGroupForFamily("easy -ru pattern")?.id).toBe("cut-before");
    expect(getVerbGroupForFamily("-u pattern")?.id).toBe("last-sound");
    expect(getVerbGroupForFamily("special")?.id).toBe("special");
  });
});
