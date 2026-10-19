import { gradeAttempt } from "@/lib/lantite/grade";
import { DIFFICULTY_LABELS, KIND_LABELS, optionLetter, SKILL_LABELS } from "@/lib/lantite/labels";
import { bankItemById } from "@/lib/lantite/bank";
import type { CompletedAttempt } from "@/lib/lantite/types";

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function resultsToCsv(history: readonly CompletedAttempt[]): string {
  const header = [
    "completed_at",
    "test",
    "difficulty",
    "feedback",
    "timed",
    "timed_out",
    "correct",
    "total",
    "percent",
    "elapsed_seconds",
    "seed",
    "question_ids",
  ];
  const rows = [header];
  const ordered = [...history].sort((a, b) => a.completedAt - b.completedAt);
  for (const attempt of ordered) {
    const grade = gradeAttempt(attempt);
    const percent = grade.total === 0 ? "0" : String(Math.round((grade.correct / grade.total) * 100));
    rows.push([
      new Date(attempt.completedAt).toISOString(),
      KIND_LABELS[attempt.config.kind],
      DIFFICULTY_LABELS[attempt.config.difficulty],
      attempt.config.feedback,
      attempt.config.timed ? "yes" : "no",
      attempt.timedOut ? "yes" : "no",
      String(grade.correct),
      String(grade.total),
      percent,
      String(Math.round(attempt.elapsedMs / 1000)),
      String(attempt.config.seed),
      attempt.questionIds.join(" "),
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export interface PaperQuestion {
  number: number;
  stem: string;
  options: readonly string[];
}

export interface PaperGroup {
  passageId: string;
  title: string;
  textTypeLabel: string;
  text: string;
  questions: PaperQuestion[];
}

export interface KeyQuestion extends PaperQuestion {
  correctLetter: string;
  explanation: string;
  optionNotes: { letter: string; why: string; correct: boolean }[];
  skillLabel: string;
}

export interface KeyGroup {
  passageId: string;
  title: string;
  textTypeLabel: string;
  text: string;
  questions: KeyQuestion[];
}

function groupsFor(ids: readonly string[]) {
  const groups: {
    passageId: string;
    title: string;
    textTypeLabel: string;
    text: string;
    items: { id: string; number: number }[];
  }[] = [];
  ids.forEach((id, index) => {
    const item = bankItemById(id);
    if (!item) return;
    const last = groups[groups.length - 1];
    const packed = { id, number: index + 1 };
    if (last && last.passageId === item.passage.id) last.items.push(packed);
    else {
      groups.push({
        passageId: item.passage.id,
        title: item.passage.title,
        textTypeLabel: item.passage.textType,
        text: item.passage.text,
        items: [packed],
      });
    }
  });
  return groups;
}

export function buildStudentPaper(ids: readonly string[]): PaperGroup[] {
  return groupsFor(ids).map((group) => ({
    passageId: group.passageId,
    title: group.title,
    textTypeLabel: group.textTypeLabel,
    text: group.text,
    questions: group.items.flatMap((item) => {
      const bank = bankItemById(item.id);
      if (!bank) return [];
      return [{ number: item.number, stem: bank.question.stem, options: bank.question.options }];
    }),
  }));
}

export function buildAnswerKey(ids: readonly string[]): KeyGroup[] {
  return groupsFor(ids).map((group) => ({
    passageId: group.passageId,
    title: group.title,
    textTypeLabel: group.textTypeLabel,
    text: group.text,
    questions: group.items.flatMap((item) => {
      const bank = bankItemById(item.id);
      if (!bank) return [];
      const q = bank.question;
      return [
        {
          number: item.number,
          stem: q.stem,
          options: q.options,
          correctLetter: optionLetter(q.correctIndex),
          explanation: q.explanation,
          skillLabel: SKILL_LABELS[q.skill],
          optionNotes: q.options.map((_, index) => ({
            letter: optionLetter(index),
            why: q.optionWhy[index] ?? "",
            correct: index === q.correctIndex,
          })),
        },
      ];
    }),
  }));
}

export function studentPaperHidesAnswers(ids: readonly string[]): boolean {
  const paper = buildStudentPaper(ids);
  const serialized = JSON.stringify(paper);
  return !serialized.includes("correctIndex") && !serialized.includes("optionWhy") && !serialized.includes("explanation");
}
