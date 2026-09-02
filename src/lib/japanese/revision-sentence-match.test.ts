import { describe, expect, it } from "vitest";
import { matchRevisionSentence, tokenizeRomajiInput } from "./revision-sentence-match";
import { getRevisionSentencesForGate } from "./revision-sentences";

describe("revision sentence matching", () => {
  it("tokenizes romaji input", () => {
    expect(tokenizeRomajiInput("Watashi  mizu nomu")).toEqual(["watashi", "mizu", "nomu"]);
  });

  it("passes when required words appear in any order", () => {
    const required = ["watashi", "mizu", "nomu"];
    expect(matchRevisionSentence("nomu watashi mizu", required)).toBe(true);
    expect(matchRevisionSentence("watashi mizu nomu", required)).toBe(true);
  });

  it("allows extra tokens for particle flexibility", () => {
    expect(matchRevisionSentence("watashi wa mizu o nomu", ["watashi", "mizu", "nomu"])).toBe(true);
  });

  it("fails when a required word is missing", () => {
    expect(matchRevisionSentence("watashi mizu", ["watashi", "mizu", "nomu"])).toBe(false);
  });

  it("accepts common romaji variants", () => {
    expect(matchRevisionSentence("tomodachi ii", ["tomodachi", "ii"])).toBe(true);
  });
});

describe("revision sentence bank", () => {
  it("loads gate 1 and gate 2 sentences from block vocab only", () => {
    const gate1 = getRevisionSentencesForGate(1);
    const gate2 = getRevisionSentencesForGate(2);
    expect(gate1.length).toBeGreaterThanOrEqual(8);
    expect(gate2.length).toBeGreaterThanOrEqual(8);
    for (const sentence of [...gate1, ...gate2]) {
      expect(sentence.words.length).toBeGreaterThan(0);
      expect(sentence.romaji.split(" ").length).toBeGreaterThanOrEqual(sentence.words.length);
    }
  });
});
