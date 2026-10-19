import { QUESTIONS } from "@/lib/lantite/bank";
import { mulberry32, shuffle } from "@/lib/lantite/random";
import type { Difficulty, LantiteQuestion, TestConfig, TestKind } from "@/lib/lantite/types";

const PREFERENCE: Record<Difficulty, readonly Difficulty[]> = {
  easy: ["easy", "standard", "challenging"],
  standard: ["standard", "easy", "challenging"],
  challenging: ["challenging", "standard", "easy"],
};

export interface GeneratedTest {
  questionIds: string[];
  requested: number;
  available: number;
  shortfall: number;
  byDifficulty: Record<Difficulty, number>;
}

export function poolForKind(
  kind: TestKind,
  source: readonly LantiteQuestion[] = QUESTIONS,
): LantiteQuestion[] {
  if (kind === "reading") return source.filter((item) => item.category === "reading");
  if (kind === "conventions") return source.filter((item) => item.category === "conventions");
  if (kind === "pitfalls") return source.filter((item) => item.pitfall != null);
  return [...source];
}

function pickByDifficulty(
  pool: readonly LantiteQuestion[],
  count: number,
  difficulty: Difficulty,
  rng: () => number,
): LantiteQuestion[] {
  if (count <= 0 || pool.length === 0) return [];
  const chosen: LantiteQuestion[] = [];
  const used = new Set<string>();
  for (const level of PREFERENCE[difficulty]) {
    const bucket = shuffle(
      pool.filter((item) => item.difficulty === level && !used.has(item.id)),
      rng,
    );
    for (const item of bucket) {
      if (chosen.length >= count) break;
      chosen.push(item);
      used.add(item.id);
    }
  }
  return chosen;
}

function orderByPassage(
  selected: readonly LantiteQuestion[],
  source: readonly LantiteQuestion[],
  rng: () => number,
): LantiteQuestion[] {
  const index = new Map(source.map((item, position) => [item.id, position]));
  const groups = new Map<string, LantiteQuestion[]>();
  for (const item of selected) {
    const list = groups.get(item.passageId) ?? [];
    list.push(item);
    groups.set(item.passageId, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0));
  }
  return shuffle([...groups.keys()], rng).flatMap((id) => groups.get(id) ?? []);
}

function onePerSkill(
  pool: readonly LantiteQuestion[],
  count: number,
  difficulty: Difficulty,
  rng: () => number,
): LantiteQuestion[] {
  const bySkill = new Map<string, LantiteQuestion[]>();
  for (const item of pool) {
    const list = bySkill.get(item.skill) ?? [];
    list.push(item);
    bySkill.set(item.skill, list);
  }
  const chosen: LantiteQuestion[] = [];
  const used = new Set<string>();
  for (const skill of shuffle([...bySkill.keys()], rng)) {
    if (chosen.length >= count) break;
    const picked = pickByDifficulty(bySkill.get(skill) ?? [], 1, difficulty, rng)[0];
    if (!picked || used.has(picked.id)) continue;
    chosen.push(picked);
    used.add(picked.id);
  }
  return chosen;
}

function fillBalanced(
  seed: readonly LantiteQuestion[],
  pool: readonly LantiteQuestion[],
  count: number,
  difficulty: Difficulty,
  rng: () => number,
  readingShare: number,
): LantiteQuestion[] {
  if (seed.length >= count) return seed.slice(0, count);
  const readingTarget = Math.round(count * readingShare);
  const haveReading = seed.filter((item) => item.category === "reading").length;
  const haveConventions = seed.length - haveReading;
  const used = new Set(seed.map((item) => item.id));
  const extraReading = pickByDifficulty(
    pool.filter((item) => item.category === "reading" && !used.has(item.id)),
    Math.max(0, readingTarget - haveReading),
    difficulty,
    rng,
  );
  for (const item of extraReading) used.add(item.id);
  const extraConventions = pickByDifficulty(
    pool.filter((item) => item.category === "conventions" && !used.has(item.id)),
    Math.max(0, count - readingTarget - haveConventions),
    difficulty,
    rng,
  );
  for (const item of extraConventions) used.add(item.id);
  const chosen = [...seed, ...extraReading, ...extraConventions];
  if (chosen.length < count) {
    chosen.push(
      ...pickByDifficulty(
        pool.filter((item) => !used.has(item.id)),
        count - chosen.length,
        difficulty,
        rng,
      ),
    );
  }
  return chosen.slice(0, count);
}

export function generateTest(
  config: Pick<TestConfig, "kind" | "count" | "difficulty" | "seed">,
  source: readonly LantiteQuestion[] = QUESTIONS,
): GeneratedTest {
  const pool = poolForKind(config.kind, source);
  const rng = mulberry32(config.seed);
  let selected: LantiteQuestion[];
  if (config.kind === "exam") {
    selected = fillBalanced(
      onePerSkill(pool, config.count, config.difficulty, rng),
      pool,
      config.count,
      config.difficulty,
      rng,
      0.62,
    );
  } else if (config.kind === "mixed") {
    selected = fillBalanced([], pool, config.count, config.difficulty, rng, 0.62);
  } else {
    selected = pickByDifficulty(pool, config.count, config.difficulty, rng);
  }
  selected = orderByPassage(selected, source, rng);
  const byDifficulty: Record<Difficulty, number> = { easy: 0, standard: 0, challenging: 0 };
  for (const item of selected) byDifficulty[item.difficulty] += 1;
  return {
    questionIds: selected.map((item) => item.id),
    requested: config.count,
    available: pool.length,
    shortfall: Math.max(0, config.count - pool.length),
    byDifficulty,
  };
}
