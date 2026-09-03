import { describe, expect, it } from "vitest";
import {
  buildTiles,
  createInitialParticleMeta,
  meaningChoices,
  normalizeParticleText,
  shuffle,
  updateMetaAfterRound,
} from "./engine";
import { flattenVerbQuestions, getParticleLesson, getVerbLesson } from "./lessons";
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