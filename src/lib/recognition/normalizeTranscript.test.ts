import { describe, expect, it } from "vitest";
import {
  matchPairWords,
  normalizeTranscript,
} from "@/lib/recognition/normalizeTranscript";

describe("normalizeTranscript", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeTranscript("  Lack! ")).toBe("lack");
  });
});

describe("matchPairWords", () => {
  it("detects the target word alone", () => {
    expect(matchPairWords("lack", "lack", "rack")).toBe("target");
  });

  it("detects the other word alone", () => {
    expect(matchPairWords("rack", "lack", "rack")).toBe("other");
  });

  it("detects a target token inside a longer transcript", () => {
    expect(matchPairWords("I said lack", "lack", "rack")).toBe("target");
  });

  it("returns unclear when both words appear", () => {
    expect(matchPairWords("lack or rack", "lack", "rack")).toBe("unclear");
  });

  it("returns unclear for empty or unrelated speech", () => {
    expect(matchPairWords("", "lack", "rack")).toBe("unclear");
    expect(matchPairWords("hello", "lack", "rack")).toBe("unclear");
  });
});
