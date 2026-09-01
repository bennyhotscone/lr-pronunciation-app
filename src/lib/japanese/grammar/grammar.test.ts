import { describe, expect, it } from "vitest";
import { directionNiBlock } from "./blocks/direction-ni";
import { getAllGrammarBlocks, getGrammarBlock } from "./index";
import {
  checkGuidedAnswer,
  completeTeachPhase,
  createInitialGrammarSession,
} from "./engine";
import { matchGrammarEnglish, matchGrammarRomaji } from "./matching";

describe("grammar course", () => {
  it("registers direction-ni block", () => {
    expect(getAllGrammarBlocks().length).toBeGreaterThanOrEqual(1);
    const block = getGrammarBlock("direction-ni");
    expect(block?.title).toContain("に");
    expect(block?.guided.length).toBeGreaterThanOrEqual(5);
    expect(block?.recall.length).toBeGreaterThanOrEqual(4);
  });

  it("teach phase advances to guided", () => {
    const session = createInitialGrammarSession();
    expect(session.phase).toBe("teach");
    const next = completeTeachPhase(session);
    expect(next.phase).toBe("guided");
  });

  it("matches recall answers with fuzzy english and romaji", () => {
    const q = directionNiBlock.recall.find((r) => r.id === "dn-r1");
    expect(q).toBeTruthy();
    expect(matchGrammarEnglish("go to shop", q!.answers)).toBe(true);
    const ej = directionNiBlock.recall.find((r) => r.id === "dn-r5");
    expect(matchGrammarRomaji("mise ni iku", ej!.answers)).toBe(true);
  });

  it("checks guided multiple choice", () => {
    const mc = directionNiBlock.guided[0];
    expect(mc.kind).toBe("mc");
    if (mc.kind === "mc") {
      expect(checkGuidedAnswer(mc, "", 0)).toBe(true);
      expect(checkGuidedAnswer(mc, "", 1)).toBe(false);
    }
  });
});
