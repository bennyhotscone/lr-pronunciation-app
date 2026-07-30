import { describe, expect, it } from "vitest";
import {
  matchPairWords,
  normalizeTranscript,
} from "@/lib/recognition/normalizeTranscript";
import { parseProgress } from "@/lib/storage";
import { DEFAULT_PROGRESS } from "@/types/progress";

describe("normalizeTranscript", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeTranscript("  Light! ")).toBe("light");
    expect(normalizeTranscript("Right.")).toBe("right");
  });
});

describe("matchPairWords", () => {
  it("matches target and other words", () => {
    expect(matchPairWords("light", "light", "right")).toBe("target");
    expect(matchPairWords("right", "light", "right")).toBe("other");
    expect(matchPairWords("hello", "light", "right")).toBe("unclear");
  });
});

describe("parseProgress", () => {
  it("returns defaults for empty storage", () => {
    expect(parseProgress(null).progress).toEqual(DEFAULT_PROGRESS);
  });

  it("recovers from corrupt JSON", () => {
    const result = parseProgress("{not-json");
    expect(result.recovered).toBe(true);
    expect(result.progress.version).toBe(1);
  });

  it("clamps sequence and keeps listening stats", () => {
    const result = parseProgress(
      JSON.stringify({
        version: 1,
        language: "ja",
        currentSequence: 999,
        listening: {
          attempts: 4,
          correct: 3,
          confusedPairIds: { "fly-fry-1": 2 },
        },
        speaking: { attempts: 1 },
      }),
    );
    expect(result.progress.language).toBe("ja");
    expect(result.progress.currentSequence).toBe(127);
    expect(result.progress.listening.correct).toBe(3);
    expect(result.progress.listening.confusedPairIds["fly-fry-1"]).toBe(2);
  });
});
