import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANK, validateBank } from "@/lib/lantite/bank";
import { buildAnswerKey, buildStudentPaper, resultsToCsv, studentPaperHidesAnswers } from "@/lib/lantite/export";
import { generateTest } from "@/lib/lantite/generate";
import { gradeAnswers, summariseHistory } from "@/lib/lantite/grade";
import { loadStore, serializeStore } from "@/lib/lantite/storage";
import { elapsedNow, freshTimer, freezeTimer, remainingMs, stopTimer } from "@/lib/lantite/timer";
import { CONVENTION_SKILLS, READING_SKILLS, TEXT_TYPES } from "@/lib/lantite/types";

describe("LANTITE bank", () => {
  it("is a reviewed original bank of at least 700 questions", () => {
    expect(BANK.length).toBeGreaterThanOrEqual(700);
    expect(validateBank()).toEqual([]);
    const ids = BANK.map((item) => item.question.id);
    expect(new Set(ids).size).toBe(ids.length);
    const stems = BANK.map((item) => item.question.stem.trim());
    expect(new Set(stems).size).toBe(stems.length);
    for (const item of BANK) {
      expect(item.passage.text.trim().length).toBeGreaterThan(40);
      expect(/[.!?]/.test(item.passage.text)).toBe(true);
      expect(item.question.options).toHaveLength(4);
      expect(item.question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(item.question.correctIndex).toBeLessThanOrEqual(3);
      expect(item.question.explanation.trim().length).toBeGreaterThan(20);
      expect(item.question.optionWhy).toHaveLength(4);
      for (const why of item.question.optionWhy) expect(why.trim().length).toBeGreaterThan(10);
    }
    const reading = BANK.filter((item) => item.question.category === "reading").length;
    const conventions = BANK.filter((item) => item.question.category === "conventions").length;
    expect(reading).toBeGreaterThanOrEqual(450);
    expect(conventions).toBeGreaterThanOrEqual(250);
    const pitfalls = BANK.filter((item) => item.question.pitfall).length;
    expect(pitfalls).toBeGreaterThanOrEqual(65);
  });

  it("covers every text type and skill", () => {
    const types = new Set(BANK.map((item) => item.passage.textType));
    const skills = new Set(BANK.map((item) => item.question.skill));
    for (const textType of TEXT_TYPES) expect(types.has(textType)).toBe(true);
    for (const skill of [...READING_SKILLS, ...CONVENTION_SKILLS]) expect(skills.has(skill)).toBe(true);
  });
});

describe("LANTITE generator", () => {
  it("rebuilds the same test from a seed", () => {
    const config = { kind: "exam" as const, count: 20 as const, difficulty: "standard" as const, seed: 42 };
    expect(generateTest(config).questionIds).toEqual(generateTest(config).questionIds);
  });

  it("does not repeat questions and keeps kinds separate", () => {
    const reading = generateTest({ kind: "reading", count: 20, difficulty: "easy", seed: 7 });
    expect(new Set(reading.questionIds).size).toBe(reading.questionIds.length);
    const byId = new Map(BANK.map((item) => [item.question.id, item.question]));
    for (const id of reading.questionIds) expect(byId.get(id)?.category).toBe("reading");
    const pitfalls = generateTest({ kind: "pitfalls", count: 10, difficulty: "challenging", seed: 3 });
    for (const id of pitfalls.questionIds) expect(byId.get(id)?.pitfall).not.toBeNull();
  });

  it("fills 65 questions for reading, conventions, mixed, pitfalls and exam", () => {
    for (const kind of ["reading", "conventions", "mixed", "pitfalls", "exam"] as const) {
      const generated = generateTest({ kind, count: 65, difficulty: "standard", seed: 1 });
      expect(generated.shortfall, kind).toBe(0);
      expect(generated.questionIds.length, kind).toBe(65);
    }
  });

  it("reports a shortfall instead of inventing items", () => {
    const source = BANK.filter((item) => item.question.category === "reading")
      .slice(0, 3)
      .map((item) => item.question);
    const generated = generateTest({ kind: "reading", count: 10, difficulty: "standard", seed: 1 }, source);
    expect(generated.questionIds.length).toBe(3);
    expect(generated.shortfall).toBe(7);
    expect(generated.questionIds.length).toBeLessThan(10);
  });

  it("builds a 65-question exam from the bank", () => {
    const generated = generateTest({ kind: "exam", count: 65, difficulty: "standard", seed: 99 });
    expect(generated.shortfall).toBe(0);
    expect(generated.questionIds.length).toBe(65);
    const byId = new Map(BANK.map((item) => [item.question.id, item.question]));
    const skills = new Set(generated.questionIds.map((id) => byId.get(id)?.skill));
    expect(skills.size).toBeGreaterThanOrEqual(10);
    const reading = generated.questionIds.filter((id) => byId.get(id)?.category === "reading").length;
    expect(reading).toBeGreaterThan(20);
    expect(reading).toBeLessThan(65);
  });
});

describe("LANTITE grading and storage", () => {
  it("marks unanswered items incorrect and explains a partial score", () => {
    const ids = BANK.slice(0, 4).map((item) => item.question.id);
    const first = BANK[0]?.question;
    const second = BANK[1]?.question;
    if (!first || !second) throw new Error("bank missing");
    const report = gradeAnswers(ids, {
      [first.id]: first.correctIndex,
      [second.id]: (second.correctIndex + 1) % 4,
    });
    expect(report.correct).toBe(1);
    expect(report.unanswered).toBe(2);
    expect(report.total).toBe(4);
    expect(report.rows[1]?.right).toBe(false);
  });

  it("resumes timer elapsed time after a gap", () => {
    const started = freshTimer(1_000);
    const frozen = freezeTimer(started, 6_000);
    expect(elapsedNow(frozen, 6_000)).toBe(5_000);
    const resumed = { ...frozen, running: true, lastResumedAt: 10_000 };
    expect(elapsedNow(resumed, 12_500)).toBe(7_500);
    expect(stopTimer(resumed, 12_500).running).toBe(false);
    const limit = remainingMs(resumed, 10, 12_500);
    expect(limit).toBeLessThan(12 * 60 * 1000);
  });

  it("round-trips versioned storage and recovers corrupt data", () => {
    const generated = generateTest({ kind: "mixed", count: 10, difficulty: "easy", seed: 5 });
    const store = {
      version: 1,
      history: [],
      inProgress: {
        id: "a-test",
        config: { kind: "mixed" as const, count: 10 as const, difficulty: "easy" as const, timed: true, feedback: "exam" as const, seed: 5 },
        questionIds: generated.questionIds,
        answers: { [generated.questionIds[0] ?? ""]: 1 },
        flagged: [generated.questionIds[1] ?? ""],
        currentIndex: 3,
        startedAt: 20,
        timer: { elapsedMs: 4000, running: true, lastResumedAt: 9000 },
        bankVersion: 1,
      },
      ui: { view: "sit" as const, activeAttemptId: null, reviewIndex: 0 },
    };
    const loaded = loadStore(serializeStore(store));
    expect(loaded.recovered).toBe(false);
    expect(loaded.store.inProgress?.currentIndex).toBe(3);
    expect(loaded.store.inProgress?.answers[generated.questionIds[0] ?? ""]).toBe(1);
    expect(loadStore("{nope").recovered).toBe(true);
    const migrated = loadStore(JSON.stringify({ history: store.history, inProgress: store.inProgress, ui: store.ui }));
    expect(migrated.migrated).toBe(true);
    expect(migrated.store.version).toBe(1);
  });

  it("summarises history and exports csv without calling a score a pass", () => {
    const question = BANK[0]?.question;
    if (!question) throw new Error("missing");
    const attempt = {
      id: "h1",
      questionIds: [question.id],
      answers: { [question.id]: question.correctIndex },
      completedAt: 1_700_000_000_000,
      config: { kind: "reading" as const, count: 10 as const, difficulty: "easy" as const, timed: false, feedback: "practice" as const, seed: 1 },
      flagged: [],
      startedAt: 1,
      elapsedMs: 1000,
      timedOut: false,
      bankVersion: 1,
    };
    const summary = summariseHistory([attempt]);
    expect(summary.attempts).toBe(1);
    expect(summary.trend[0]?.correct).toBe(1);
    const csv = resultsToCsv([attempt]);
    expect(csv).toContain("correct");
    expect(csv.toLowerCase()).not.toContain("pass mark");
    expect(csv.toLowerCase()).not.toContain("official");
  });
});

describe("LANTITE print and access", () => {
  it("keeps answers off the student paper model", () => {
    const ids = BANK.slice(0, 3).map((item) => item.question.id);
    const paper = buildStudentPaper(ids);
    expect(paper[0]?.questions.length).toBeGreaterThan(0);
    expect(studentPaperHidesAnswers(ids)).toBe(true);
    const key = buildAnswerKey(ids);
    expect(key[0]?.questions[0]?.correctLetter).toMatch(/[A-D]/);
    expect(key[0]?.questions[0]?.optionNotes).toHaveLength(4);
  });

  it("does not put /lantite behind the auth matcher", () => {
    const middleware = readFileSync("src/middleware.ts", "utf8");
    const matcher = middleware.slice(middleware.indexOf("matcher"));
    expect(matcher).not.toContain("lantite");
  });

  it("links the homepage card to /lantite", () => {
    const home = readFileSync("src/app/(marketing)/page.tsx", "utf8");
    expect(home).toContain('href: "/lantite"');
    expect(home).toContain("LANTITE Literacy Practice");
  });
});
