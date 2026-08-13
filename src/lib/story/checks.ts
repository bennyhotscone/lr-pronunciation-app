import { countWords, type StoryCheckIssue } from "./types";

export type DeterministicCheckInput = {
  sections: { beginning: string; middle: string; climax: string; ending: string };
  wordTarget: number;
  wordMin?: number | null;
  wordMax?: number | null;
  grammarFocus: string[];
  vocabList: string[];
  vocabMinCount?: number | null;
  vocabRequireAll: boolean;
  plan: {
    characterName?: string | null;
    goalText?: string | null;
    problemText?: string | null;
    climaxIdea?: string | null;
    resolutionText?: string | null;
  };
};

const PAST_SIMPLE_HINT = /\b\w+(ed|ied)\b|\b(was|were|went|said|took|made|came|saw|got|had|did|found|left|told|felt|thought|knew|began)\b/i;
const PAST_CONT = /\b(was|were)\s+\w+ing\b/i;
const PAST_PERF = /\bhad\s+(been\s+)?\w+(ed|en|n)?\b/i;
const PAST_PERF_CONT = /\bhad\s+been\s+\w+ing\b/i;

function fullText(sections: DeterministicCheckInput["sections"]) {
  return [sections.beginning, sections.middle, sections.climax, sections.ending].join("\n");
}

/** Deterministic checks — always available; no LLM required. */
export function runDeterministicStoryChecks(input: DeterministicCheckInput): StoryCheckIssue[] {
  const issues: StoryCheckIssue[] = [];
  const text = fullText(input.sections);
  const words = countWords(text);
  const target = input.wordTarget || 300;
  const min = input.wordMin ?? Math.round(target * 0.7);
  const max = input.wordMax ?? Math.round(target * 1.35);

  if (words < min) {
    issues.push({
      code: "WORD_LOW",
      severity: "warn",
      message: `Your draft is about ${words} words (aim ≥ ${min}).`,
      hint: "Add detail from your plan — do not invent a new plot.",
      target: "draft",
    });
  } else if (words > max) {
    issues.push({
      code: "WORD_HIGH",
      severity: "info",
      message: `Your draft is about ${words} words (aim ≤ ${max}).`,
      hint: "Trim repeated ideas; keep your own plan.",
      target: "draft",
    });
  } else {
    issues.push({
      code: "WORD_OK",
      severity: "info",
      message: `Word count looks on track (~${words} words).`,
      target: "draft",
    });
  }

  for (const [key, label] of [
    ["beginning", "Beginning"],
    ["middle", "Middle"],
    ["climax", "Climax"],
    ["ending", "Ending"],
  ] as const) {
    if (countWords(input.sections[key]) < 1) {
      issues.push({
        code: "SECTION_EMPTY",
        severity: "error",
        message: `${label} section is empty.`,
        hint: "Write this section yourself using your Story Map.",
        target: key,
      });
    }
  }

  // Vocab
  const lower = text.toLowerCase();
  const vocab = input.vocabList.map((v) => v.trim()).filter(Boolean);
  if (vocab.length) {
    const used = vocab.filter((v) => lower.includes(v.toLowerCase()));
    if (input.vocabRequireAll && used.length < vocab.length) {
      const missing = vocab.filter((v) => !used.includes(v));
      issues.push({
        code: "VOCAB_ALL",
        severity: "warn",
        message: `Required vocabulary missing: ${missing.join(", ")}.`,
        hint: "Fit these words into sentences you already planned.",
        target: "requirements",
      });
    } else if (input.vocabMinCount && used.length < input.vocabMinCount) {
      issues.push({
        code: "VOCAB_MIN",
        severity: "warn",
        message: `Used ${used.length} of ${vocab.length} vocab items (need ≥ ${input.vocabMinCount}).`,
        hint: "Choose items from your list that fit your plan.",
        target: "requirements",
      });
    } else if (used.length) {
      issues.push({
        code: "VOCAB_OK",
        severity: "info",
        message: `Vocabulary used: ${used.join(", ")}.`,
        target: "requirements",
      });
    }
  }

  // Grammar focus presence (heuristic only — never rewrites).
  for (const focus of input.grammarFocus) {
    const f = focus.toLowerCase();
    let ok = false;
    if (f.includes("perfect continuous")) ok = PAST_PERF_CONT.test(text);
    else if (f.includes("perfect")) ok = PAST_PERF.test(text);
    else if (f.includes("continuous")) ok = PAST_CONT.test(text);
    else if (f.includes("simple")) ok = PAST_SIMPLE_HINT.test(text);
    if (!ok) {
      issues.push({
        code: "GRAMMAR_FOCUS",
        severity: "warn",
        message: `Could not clearly spot “${focus}” in your draft.`,
        hint: "Look at your plan timeline and try one sentence of your own using this form.",
        target: "language",
      });
    } else {
      issues.push({
        code: "GRAMMAR_FOCUS_OK",
        severity: "info",
        message: `Possible use of “${focus}” found.`,
        target: "language",
      });
    }
  }

  // Plan alignment — questions only, no invented plot.
  if (input.plan.characterName?.trim()) {
    const name = input.plan.characterName.trim();
    if (!text.toLowerCase().includes(name.toLowerCase().split(/\s+/)[0]!)) {
      issues.push({
        code: "PLAN_CHARACTER",
        severity: "info",
        message: `Does your draft name your character (“${name}”)?`,
        hint: "Use the name from your Character step.",
        target: "structure",
      });
    }
  }
  if (input.plan.climaxIdea?.trim() && countWords(input.sections.climax) > 0) {
    issues.push({
      code: "PLAN_CLIMAX_CHECK",
      severity: "info",
      message: "Does your climax paragraph match the climax idea on your Story Map?",
      hint: "Compare side-by-side — change only if your plan changed.",
      target: "logic",
    });
  }

  return issues;
}

export function issuesForRevisionPass(
  passKind: string,
  all: StoryCheckIssue[],
): StoryCheckIssue[] {
  const map: Record<string, string[]> = {
    structure: ["SECTION_EMPTY", "PLAN_CHARACTER", "WORD_LOW", "WORD_HIGH", "WORD_OK"],
    logic: ["PLAN_CLIMAX_CHECK"],
    timeline: ["GRAMMAR_FOCUS", "GRAMMAR_FOCUS_OK"],
    language: ["GRAMMAR_FOCUS", "GRAMMAR_FOCUS_OK"],
    requirements: ["VOCAB_ALL", "VOCAB_MIN", "VOCAB_OK", "WORD_LOW", "WORD_HIGH", "WORD_OK"],
  };
  const codes = map[passKind] || [];
  const filtered = all.filter((i) => codes.includes(i.code));
  if (!filtered.length) {
    return [
      {
        code: "PASS_OK",
        severity: "info",
        message: `No automatic ${passKind} flags. Re-read this pass yourself using your plan.`,
        hint: "Ask: does this section still match my Story Map?",
      },
    ];
  }
  return filtered;
}
