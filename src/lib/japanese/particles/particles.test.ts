import { describe, expect, it } from "vitest";
import {
  buildTiles,
  createInitialParticleMeta,
  formatVerbFormLabel,
  mcChoices,
  meaningChoices,
  normalizeParticleText,
  shuffle,
  updateMetaAfterRound,
} from "./engine";
import { flattenVerbQuestions, getParticleLesson, getVerbLesson } from "./lessons";
import { getVerbEndingMnemonic } from "./mnemonics";
import { matchParticleRomaji, matchParticleSentence } from "./matching";
import { isParticleLessonAccessible, isParticleRoundAccessible } from "./unlock";

describe("flattenVerbQuestions", () => {
  it("includes every verb form with romaji and meaning", () => {
    const qs = flattenVerbQuestions();
    expect(qs.length).toBeGreaterThan(40);
    expect(qs[0].romaji).toBeTruthy();
    expect(qs[0].en).toBeTruthy();
    expect(qs[0].base).toBeTruthy();
  });
});

describe("shuffle", () => {
  it("returns a permutation", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out.sort()).toEqual(input.sort());
  });
});

describe("buildTiles", () => {
  it("uses question tiles for particle lessons", () => {
    const lesson = getParticleLesson("o");
    expect(lesson).toBeTruthy();
    const q = lesson!.questions[0];
    const tiles = buildTiles(lesson!, q);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => q.tiles?.includes(t))).toBe(true);
  });

  it("limits verb lesson tiles to twelve forms", () => {
    const lesson = getVerbLesson();
    const q = lesson.questions[0];
    const tiles = buildTiles(lesson, q);
    expect(tiles.length).toBeLessThanOrEqual(12);
    expect(tiles.includes(q.romaji)).toBe(true);
  });
});


describe("formatVerbFormLabel", () => {
  it("labels tabenai clearly", () => {
    const lesson = getVerbLesson();
    const tabenai = lesson.questions.find((q) => q.romaji === "tabenai");
    expect(formatVerbFormLabel(tabenai!)).toBe("taberu -> tabenai - don't eat");
  });
});

describe("mcChoices", () => {
  it("shows conjugated romaji for form mode", () => {
    const lesson = getVerbLesson();
    const q = lesson.questions.find((item) => item.base === "taberu" && item.romaji === "tabeta");
    expect(q).toBeTruthy();
    const choices = mcChoices(q!, lesson.questions, "form");
    expect(choices.some((c) => c.romaji === "tabeta" && c.base === "taberu")).toBe(true);
    expect(choices.every((c) => c.base && c.romaji && c.en)).toBe(true);
  });

  it("shows full form romaji for verb mode", () => {
    const lesson = getVerbLesson();
    const q = lesson.questions[0];
    const choices = mcChoices(q, lesson.questions, "verb");
    expect(choices.some((c) => c.romaji === q.base && c.base === q.base)).toBe(true);
    expect(choices.every((c) => c.base && c.romaji && c.en)).toBe(true);
  });
});

describe("verb ending mnemonics", () => {
  it("maps desire-negative endings to plain English hooks", () => {
    expect(getVerbEndingMnemonic("takunakatta")?.hint).toBe("didn't want to (past)");
    expect(getVerbEndingMnemonic("itakunakatta", "ikitakunakatta")?.hint).toMatch(/didn't want to/i);
    expect(getVerbEndingMnemonic("takunai")?.hint).toBe("don't want to");
    expect(getVerbEndingMnemonic("nakatta")?.hint).toBe("didn't do (past)");
  });
});

describe("verb desire negatives", () => {
  it("includes didn't want to forms for every verb family", () => {
    const qs = flattenVerbQuestions();
    const endings = qs.map((q) => q.ending);
    expect(endings).toContain("takunakatta");
    expect(endings).toContain("itakunakatta");
    expect(qs.some((q) => q.en === "didn't want to eat")).toBe(true);
    expect(qs.some((q) => q.en === "didn't want to go")).toBe(true);
  });
});

describe("meaningChoices", () => {
  it("includes the correct meaning and stays unique", () => {
    const lesson = getVerbLesson();
    const q = lesson.questions[0];
    const choices = meaningChoices(q, lesson.questions, true);
    expect(choices).toContain(q.en);
    const norms = choices.map((c) => normalizeParticleText(c));
    expect(new Set(norms).size).toBe(norms.length);
  });
});

describe("matching", () => {
  it("normalizes romaji answers with spaces", () => {
    expect(matchParticleSentence(["gakkou", "ni", "iku"], "gakkou ni iku")).toBe(true);
    expect(matchParticleRomaji("Gakkou ni iku!", "gakkou ni iku")).toBe(true);
  });
});

describe("unlock helpers", () => {
  it("allows early lessons when block 3 vocabulary gate is open", () => {
    expect(isParticleLessonAccessible("verbs", false, 0, {})).toBe(true);
    expect(isParticleLessonAccessible("o", false, 0, { verbs: true })).toBe(true);
    expect(isParticleLessonAccessible("o", false, 0, {})).toBe(false);
  });

  it("requires teach before build round", () => {
    const meta = createInitialParticleMeta();
    expect(
      isParticleRoundAccessible("build", meta, "o", false, 0),
    ).toBe(false);
    const taught = { ...meta, teachSeen: true };
    expect(isParticleRoundAccessible("build", taught, "o", false, 0)).toBe(true);
  });

  it("marks lesson mastered when all required rounds pass", () => {
    const meta = updateMetaAfterRound(createInitialParticleMeta(), "o", "teach", 1, 1);
    const built = updateMetaAfterRound(meta, "o", "build", 3, 3);
    const listened = updateMetaAfterRound(built, "o", "listenType", 3, 3);
    const done = updateMetaAfterRound(listened, "o", "typeRomaji", 3, 3);
    expect(done.mastered).toBe(true);
  });
});