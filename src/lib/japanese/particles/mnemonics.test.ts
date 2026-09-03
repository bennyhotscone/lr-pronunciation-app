import { describe, expect, it } from "vitest";
import {
  formatEndingMnemonicLine,
  formatEndingMnemonicShort,
  getVerbEndingMnemonic,
} from "./mnemonics";

describe("verb ending mnemonics", () => {
  it("maps nai to nope", () => {
    expect(getVerbEndingMnemonic("nai")?.sound).toBe("nope");
    expect(formatEndingMnemonicShort("nai")).toBe("nope");
  });

  it("maps katta romaji to cutter", () => {
    expect(getVerbEndingMnemonic(undefined, "tabekatta")?.sound).toBe("cutter");
    expect(formatEndingMnemonicLine("katta", "tabekatta")).toContain("cutter");
  });

  it("maps shita and nda", () => {
    expect(getVerbEndingMnemonic(undefined, "shita")?.sound).toBe("she did it");
    expect(getVerbEndingMnemonic(undefined, "nonda")?.sound).toBe("ended");
  });
});