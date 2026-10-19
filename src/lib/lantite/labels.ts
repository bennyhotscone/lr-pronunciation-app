import type {
  Difficulty,
  FeedbackMode,
  Skill,
  TestKind,
  TextType,
} from "@/lib/lantite/types";

export const DISCLAIMER =
  "Independent LANTITE-style literacy practice — not affiliated with or endorsed by ACER";

export const DATA_NOTICE =
  "Answers, the question you are on, test settings, the timer and completed attempts are saved only in this browser on this device. Nothing is uploaded, and nothing syncs to another phone, browser or computer. Clearing site data, using a private window, or switching devices can delete this practice.";

export const SCORE_NOTICE =
  "This percentage is practice feedback only. It is not an official result, and it does not predict a pass or fail on any real test.";

export const TIMER_NOTICE =
  "Timed sittings use a practice allowance for this tool. The allowance is not an official test duration.";

export const BANK_NOTICE =
  "Each test is drawn from a fixed bank of 700 original practice questions. It does not generate new questions, and it will not repeat an item inside one test.";

export const TEXT_TYPE_LABELS: Record<TextType, string> = {
  "research-summary": "Research summary",
  "workplace-email": "Workplace email",
  "public-notice": "Public information notice",
  "policy-extract": "Policy extract",
  "opinion-column": "Opinion column",
  "statistical-report": "Statistical report",
  "academic-passage": "Academic passage",
};

export const SKILL_LABELS: Record<Skill, string> = {
  "locate-retrieve": "Locate and retrieve",
  infer: "Infer",
  "tone-purpose": "Tone and purpose",
  "argument-evidence": "Argument and evidence",
  "evaluate-claims": "Evaluate claims and assumptions",
  "qualifications-limitations": "Qualifications and limitations",
  "correlation-causation": "Correlation and causation",
  "subject-verb-agreement": "Subject–verb agreement",
  "pronoun-reference": "Pronoun reference",
  "sentence-structure": "Sentence structure",
  punctuation: "Punctuation",
  "spelling-confused-words": "Spelling and confused words",
  "register-word-choice": "Register and word choice",
  "cohesion-paragraph": "Cohesion and paragraph organisation",
};

export const KIND_LABELS: Record<TestKind, string> = {
  reading: "Reading comprehension only",
  conventions: "Grammar, spelling and punctuation only",
  mixed: "Mixed literacy",
  pitfalls: "Common pitfalls training",
  exam: "Full exam-style simulation",
};

export const KIND_DETAILS: Record<TestKind, string> = {
  reading:
    "Passages with questions on locating, inferring, purpose, argument, evaluation and the limits of evidence.",
  conventions:
    "Short workplace and public texts that target agreement, reference, sentence structure, punctuation, spelling, register and cohesion.",
  mixed:
    "A balanced draw of reading questions and writing-convention questions.",
  pitfalls:
    "Items marked as frequent traps, such as treating a correlation as a cause, missing a limitation, or choosing a confused word.",
  exam:
    "A balanced literacy paper. Choose 65 questions for the full-length simulation. It is not an official paper.",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  standard: "Standard",
  challenging: "Challenging",
};

export const DIFFICULTY_DETAILS: Record<Difficulty, string> = {
  easy: "Prefers easier items, then fills from other bands so the test can still reach the length you chose.",
  standard:
    "Prefers mid-level items, then fills from other bands if needed.",
  challenging:
    "Prefers harder items, then fills from other bands if the harder set is smaller than the test.",
};

export const FEEDBACK_LABELS: Record<FeedbackMode, string> = {
  practice: "Practice — feedback as you answer",
  exam: "Exam — answers hidden until you submit",
};

export const STUDY_SUGGESTIONS: Record<Skill, string> = {
  "locate-retrieve":
    "Underline the words the question repeats, then check the sentence that actually states the fact. Watch for numbers that belong to a different detail.",
  infer:
    "Start from a stated fact, then ask what follows from it. Reject a guess that the text never supports.",
  "tone-purpose":
    "Name the writer’s job in one verb: inform, instruct, argue, or qualify. A vivid detail is not always the purpose.",
  "argument-evidence":
    "Separate the claim from the example used to support it. An example illustrates a point; it is not always a second claim.",
  "evaluate-claims":
    "Ask what the writer assumes, and what evidence would weaken that assumption. Do not upgrade a cautious claim into a stronger one.",
  "qualifications-limitations":
    "Mark phrases such as ‘only’, ‘did not measure’ and ‘the authors note’. Those phrases limit what the text can show.",
  "correlation-causation":
    "If two things occur together, list other differences between the groups before you call one the cause.",
  "subject-verb-agreement":
    "Find the real subject, not the noun closest to the verb. Phrases such as ‘of the results’ do not change a singular subject.",
  "pronoun-reference":
    "Replace the pronoun with the noun you think it means. If more than one noun fits, the reference is unclear.",
  "sentence-structure":
    "Check that each sentence has a subject and a finite verb, and that a modifier sits next to the thing it describes.",
  punctuation:
    "Read the sentence aloud at the punctuation mark. A comma cannot join two full sentences on its own.",
  "spelling-confused-words":
    "Decide the word’s job in the sentence (noun or verb, ‘who is’ or ‘belonging to’) before you choose the spelling.",
  "register-word-choice":
    "Match the audience. A policy or a note to families needs plain, respectful wording rather than chat language.",
  "cohesion-paragraph":
    "Check that each sentence answers the one before it. A contrast word such as ‘however’ needs a real contrast.",
};

/** Practice allowances in milliseconds. Not official durations. */
export const PRACTICE_LIMIT_MS: Record<10 | 20 | 32 | 65, number> = {
  10: 12 * 60 * 1000,
  20: 25 * 60 * 1000,
  32: 40 * 60 * 1000,
  65: 90 * 60 * 1000,
};

export function optionLetter(index: number): string {
  return ["A", "B", "C", "D"][index] ?? "?";
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return clock;
}

export function formatPercent(correct: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((correct / total) * 100)}%`;
}
