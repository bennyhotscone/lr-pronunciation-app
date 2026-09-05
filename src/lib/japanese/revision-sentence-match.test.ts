import { describe, expect, it } from "vitest";
import {
  matchAcceptedSentenceAnswers,
  matchRevisionSentence,
  tokenizeRomajiInput,
} from "./revision-sentence-match";
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

  it("accepts preferred and caveman sequences", () => {
    const preferred = ["ie", "de", "taberu"];
    const accepted = [["ie", "taberu"]];
    expect(matchAcceptedSentenceAnswers(["ie", "de", "taberu"], preferred, accepted)).toEqual({
      ok: true,
      preferred: true,
      caveman: false,
    });
    expect(matchAcceptedSentenceAnswers("ie taberu", preferred, accepted).ok).toBe(true);
    expect(matchAcceptedSentenceAnswers("ie taberu", preferred, accepted).caveman).toBe(true);
  });
});

describe("revision sentence bank", () => {
  it("loads gates 1–4 with preferredAnswer + tiles", () => {
    for (const gate of [1, 2, 3, 4]) {
      const sentences = getRevisionSentencesForGate(gate);
      expect(sentences.length).toBeGreaterThanOrEqual(8);
      for (const sentence of sentences) {
        expect(sentence.preferredAnswer.length).toBeGreaterThan(0);
        expect(sentence.tiles.length).toBeGreaterThan(0);
        expect(sentence.romaji.split(" ").length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
