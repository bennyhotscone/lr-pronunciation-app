import { describe, expect, it } from "vitest";
import {
  matchPairWords,
  normalizeTranscript,
  levenshtein,
  phoneticKey,
} from "@/lib/recognition/normalizeTranscript";

describe("normalizeTranscript", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeTranscript("  Lack! ")).toBe("lack");
    expect(normalizeTranscript("Right.")).toBe("right");
    expect(normalizeTranscript(" light ")).toBe("light");
  });
});

describe("levenshtein + phoneticKey", () => {
  it("measures edit distance", () => {
    expect(levenshtein("cat", "car")).toBe(1);
    expect(levenshtein("lack", "rack")).toBe(1);
    expect(levenshtein("lack", "lack")).toBe(0);
    expect(levenshtein("right", "write")).toBeGreaterThan(0);
    expect(levenshtein("right", "write")).toBeLessThanOrEqual(4);
  });

  it("maps common variants to similar keys", () => {
    expect(phoneticKey("right")).toBe(phoneticKey("write"));
    expect(phoneticKey("light")).toBe(phoneticKey("lite"));
  });
});

describe("matchPairWords forced choice", () => {
  it("detects the target word alone", () => {
    expect(matchPairWords("lack", "lack", "rack")).toBe("target");
  });

  it("detects the other word alone", () => {
    expect(matchPairWords("rack", "lack", "rack")).toBe("other");
  });

  it("detects a target token inside a longer transcript", () => {
    expect(matchPairWords("I said lack", "lack", "rack")).toBe("target");
  });

  it("accepts punctuation and casing", () => {
    expect(matchPairWords("Right.", "right", "light")).toBe("target");
    expect(matchPairWords(" LIGHT ", "light", "right")).toBe("target");
  });

  it("maps common Whisper homophones to the pair word", () => {
    expect(matchPairWords("write", "right", "light")).toBe("target");
    expect(matchPairWords("lite", "light", "right")).toBe("target");
    expect(matchPairWords("wright", "right", "light")).toBe("target");
    expect(matchPairWords("reign", "rain", "lane")).toBe("target");
  });

  it("returns unclear when empty or unrelated", () => {
    expect(matchPairWords("", "lack", "rack")).toBe("unclear");
    expect(matchPairWords("   ", "lack", "rack")).toBe("unclear");
    expect(matchPairWords("hello", "lack", "rack")).toBe("unclear");
    expect(matchPairWords("banana smoothie", "light", "right")).toBe("unclear");
  });

  it("returns unclear when both pair words appear", () => {
    expect(matchPairWords("lack or rack", "lack", "rack")).toBe("unclear");
  });

  it("prefers the closer of two near-miss spellings", () => {
    expect(matchPairWords("lak", "lack", "rack")).toBe("target");
    expect(matchPairWords("rak", "lack", "rack")).toBe("other");
  });

  it("handles light/right without claiming phoneme certainty on garbage", () => {
    expect(matchPairWords("xyzzy", "light", "right")).toBe("unclear");
  });
});
