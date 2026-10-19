import { CONVENTION_PASSAGES, CONVENTION_QUESTIONS } from "@/lib/lantite/conventions";
import { CONVENTION_PASSAGES_EXTRA, CONVENTION_QUESTIONS_B } from "@/lib/lantite/conventions-b";
import { CONVENTION_QUESTIONS_C } from "@/lib/lantite/conventions-c";
import { READING_PASSAGES } from "@/lib/lantite/passages";
import { READING_PASSAGES_EXTRA } from "@/lib/lantite/passages-extra";
import { READING_QUESTIONS_A } from "@/lib/lantite/reading-a";
import { READING_QUESTIONS_B } from "@/lib/lantite/reading-b";
import { READING_QUESTIONS_C } from "@/lib/lantite/reading-c";
import { READING_QUESTIONS_D } from "@/lib/lantite/reading-d";
import { READING_QUESTIONS_E } from "@/lib/lantite/reading-e";
import type { BankItem, LantitePassage, LantiteQuestion } from "@/lib/lantite/types";
import { BANK_VERSION, CONVENTION_SKILLS, READING_SKILLS, TEXT_TYPES } from "@/lib/lantite/types";

export { BANK_VERSION };

const passages: readonly LantitePassage[] = [...READING_PASSAGES, ...READING_PASSAGES_EXTRA, ...CONVENTION_PASSAGES, ...CONVENTION_PASSAGES_EXTRA];
const questions: readonly LantiteQuestion[] = [
  ...READING_QUESTIONS_A,
  ...READING_QUESTIONS_B,
  ...READING_QUESTIONS_C,
  ...READING_QUESTIONS_D,
  ...READING_QUESTIONS_E,
  ...CONVENTION_QUESTIONS,
  ...CONVENTION_QUESTIONS_B,
  ...CONVENTION_QUESTIONS_C,
];

const passageById = new Map(passages.map((passage) => [passage.id, passage]));

export const BANK: readonly BankItem[] = questions.map((item) => {
  const passage = passageById.get(item.passageId);
  if (!passage) {
    throw new Error(`Missing passage ${item.passageId} for ${item.id}`);
  }
  return { question: item, passage };
});

export const QUESTIONS: readonly LantiteQuestion[] = BANK.map((item) => item.question);

export function passageFor(id: string): LantitePassage | undefined {
  return passageById.get(id);
}

export function questionById(id: string): LantiteQuestion | undefined {
  return QUESTIONS.find((item) => item.id === id);
}

export function bankItemById(id: string): BankItem | undefined {
  return BANK.find((item) => item.question.id === id);
}

export interface BankIssue {
  id: string;
  message: string;
}

const PLACEHOLDER = /\b(todo|tbd|placeholder|lorem ipsum|xxx)\b/i;
const BANNED_SPELLING = /\b(analyze|color|favor|behavior|center)\b/i;

export function validateBank(items: readonly BankItem[] = BANK): BankIssue[] {
  const issues: BankIssue[] = [];
  const ids = new Set<string>();
  const textTypes = new Set<string>();
  const skills = new Set<string>();

  for (const { question: q, passage } of items) {
    textTypes.add(passage.textType);
    skills.add(q.skill);
    if (ids.has(q.id)) issues.push({ id: q.id, message: "Duplicate question id" });
    ids.add(q.id);
    if (!q.id.trim()) issues.push({ id: q.id, message: "Empty id" });
    const passageText = passage.text.trim();
    if (passageText.length < 80 || !/[.!?]/.test(passageText)) {
      issues.push({ id: q.id, message: "Passage or stimulus text is missing a readable sentence" });
    }
    if (!passage.title.trim()) {
      issues.push({ id: q.id, message: "Passage title is missing" });
    }
    if (q.stem.trim().length < 12) issues.push({ id: q.id, message: "Stem is too short" });
    if (q.options.length !== 4) issues.push({ id: q.id, message: "Expected four options" });
    if (new Set(q.options.map((option) => option.trim())).size !== 4) {
      issues.push({ id: q.id, message: "Options are not unique" });
    }
    if (q.correctIndex < 0 || q.correctIndex > 3) {
      issues.push({ id: q.id, message: "Correct index out of range" });
    }
    if (q.explanation.trim().length < 40) {
      issues.push({ id: q.id, message: "Explanation is too short" });
    }
    q.optionWhy.forEach((why, index) => {
      if (why.trim().length < 20) {
        issues.push({ id: q.id, message: `Option ${index} explanation is too short` });
      }
    });
    if (q.optionWhy.length !== 4) {
      issues.push({ id: q.id, message: "Expected four option explanations" });
    }
    const blob = [passage.text, q.stem, ...q.options, q.explanation, ...q.optionWhy].join("\n");
    if (PLACEHOLDER.test(blob)) issues.push({ id: q.id, message: "Placeholder text" });
    if (BANNED_SPELLING.test(blob)) issues.push({ id: q.id, message: "Unexpected American spelling" });
    if (q.category === "reading" && !READING_SKILLS.includes(q.skill as (typeof READING_SKILLS)[number])) {
      issues.push({ id: q.id, message: "Reading item has a non-reading skill" });
    }
    if (
      q.category === "conventions" &&
      !CONVENTION_SKILLS.includes(q.skill as (typeof CONVENTION_SKILLS)[number])
    ) {
      issues.push({ id: q.id, message: "Convention item has a non-convention skill" });
    }
    if (q.tags.length === 0) issues.push({ id: q.id, message: "Missing tags" });
  }

  for (const textType of TEXT_TYPES) {
    if (!textTypes.has(textType)) issues.push({ id: "bank", message: `Missing text type ${textType}` });
  }
  for (const skill of [...READING_SKILLS, ...CONVENTION_SKILLS]) {
    if (!skills.has(skill)) issues.push({ id: "bank", message: `Missing skill ${skill}` });
  }
  if (items.length < 50) issues.push({ id: "bank", message: "Fewer than 50 questions" });
  return issues;
}
