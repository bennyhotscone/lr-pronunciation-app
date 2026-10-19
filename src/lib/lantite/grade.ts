import { questionById } from "@/lib/lantite/bank";
import type { CompletedAttempt, LantiteQuestion, Skill } from "@/lib/lantite/types";

export interface GradeRow {
  id: string;
  missing: boolean;
  selected: number | null;
  correctIndex: number | null;
  right: boolean;
  skill: Skill | null;
  category: "reading" | "conventions" | null;
  pitfallId: string | null;
  pitfallLabel: string | null;
}

export interface SkillTally {
  skill: Skill;
  correct: number;
  total: number;
}

export interface GradeReport {
  correct: number;
  total: number;
  unanswered: number;
  missing: number;
  rows: GradeRow[];
  bySkill: SkillTally[];
  byCategory: { reading: SkillTally; conventions: SkillTally };
  pitfallMisses: { id: string; label: string; count: number }[];
}

function emptyCategory(skill: Skill): SkillTally {
  return { skill, correct: 0, total: 0 };
}

export function gradeAnswers(
  questionIds: readonly string[],
  answers: Record<string, number | null | undefined>,
  lookup: (id: string) => LantiteQuestion | undefined = questionById,
): GradeReport {
  const rows: GradeRow[] = [];
  const skillMap = new Map<Skill, SkillTally>();
  const categories = {
    reading: emptyCategory("locate-retrieve"),
    conventions: emptyCategory("subject-verb-agreement"),
  };
  const pitfalls = new Map<string, { id: string; label: string; count: number }>();
  let correct = 0;
  let unanswered = 0;
  let missing = 0;

  for (const id of questionIds) {
    const question = lookup(id);
    const selected = answers[id];
    const chosen = typeof selected === "number" ? selected : null;
    if (!question) {
      missing += 1;
      rows.push({
        id,
        missing: true,
        selected: chosen,
        correctIndex: null,
        right: false,
        skill: null,
        category: null,
        pitfallId: null,
        pitfallLabel: null,
      });
      continue;
    }
    if (chosen == null) unanswered += 1;
    const right = chosen === question.correctIndex;
    if (right) correct += 1;
    const tally = skillMap.get(question.skill) ?? { skill: question.skill, correct: 0, total: 0 };
    tally.total += 1;
    if (right) tally.correct += 1;
    skillMap.set(question.skill, tally);
    const bucket = categories[question.category];
    bucket.total += 1;
    if (right) bucket.correct += 1;
    if (!right && question.pitfall) {
      const current = pitfalls.get(question.pitfall.id) ?? {
        id: question.pitfall.id,
        label: question.pitfall.label,
        count: 0,
      };
      current.count += 1;
      pitfalls.set(question.pitfall.id, current);
    }
    rows.push({
      id,
      missing: false,
      selected: chosen,
      correctIndex: question.correctIndex,
      right,
      skill: question.skill,
      category: question.category,
      pitfallId: question.pitfall?.id ?? null,
      pitfallLabel: question.pitfall?.label ?? null,
    });
  }

  return {
    correct,
    total: questionIds.length - missing,
    unanswered,
    missing,
    rows,
    bySkill: [...skillMap.values()].sort((a, b) => a.skill.localeCompare(b.skill)),
    byCategory: categories,
    pitfallMisses: [...pitfalls.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}

export function gradeAttempt(attempt: Pick<CompletedAttempt, "questionIds" | "answers">): GradeReport {
  return gradeAnswers(attempt.questionIds, attempt.answers);
}

export interface HistorySummary {
  attempts: number;
  bySkill: SkillTally[];
  pitfallMisses: { id: string; label: string; count: number }[];
  trend: { id: string; completedAt: number; correct: number; total: number }[];
}

export function summariseHistory(
  attempts: readonly Pick<CompletedAttempt, "id" | "questionIds" | "answers" | "completedAt">[],
): HistorySummary {
  const skillMap = new Map<Skill, SkillTally>();
  const pitfalls = new Map<string, { id: string; label: string; count: number }>();
  const ordered = [...attempts].sort((a, b) => a.completedAt - b.completedAt);
  const trend = ordered.map((attempt) => {
    const report = gradeAttempt(attempt);
    for (const tally of report.bySkill) {
      const current = skillMap.get(tally.skill) ?? { skill: tally.skill, correct: 0, total: 0 };
      current.correct += tally.correct;
      current.total += tally.total;
      skillMap.set(tally.skill, current);
    }
    for (const miss of report.pitfallMisses) {
      const current = pitfalls.get(miss.id) ?? { id: miss.id, label: miss.label, count: 0 };
      current.count += miss.count;
      pitfalls.set(miss.id, current);
    }
    return {
      id: attempt.id,
      completedAt: attempt.completedAt,
      correct: report.correct,
      total: report.total,
    };
  });
  return {
    attempts: attempts.length,
    bySkill: [...skillMap.values()].sort((a, b) => {
      const aRate = a.total ? a.correct / a.total : 1;
      const bRate = b.total ? b.correct / b.total : 1;
      return aRate - bRate || b.total - a.total;
    }),
    pitfallMisses: [...pitfalls.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    trend,
  };
}
