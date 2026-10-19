export const STORE_VERSION = 1;
export const BANK_VERSION = 1;
export const STORAGE_KEY = "lrmastery.lantite.v1";
export const HISTORY_LIMIT = 100;

export const QUESTION_COUNTS = [10, 20, 32, 65] as const;
export type QuestionCount = (typeof QUESTION_COUNTS)[number];

export const TEXT_TYPES = [
  "research-summary",
  "workplace-email",
  "public-notice",
  "policy-extract",
  "opinion-column",
  "statistical-report",
  "academic-passage",
] as const;
export type TextType = (typeof TEXT_TYPES)[number];

export const READING_SKILLS = [
  "locate-retrieve",
  "infer",
  "tone-purpose",
  "argument-evidence",
  "evaluate-claims",
  "qualifications-limitations",
  "correlation-causation",
] as const;

export const CONVENTION_SKILLS = [
  "subject-verb-agreement",
  "pronoun-reference",
  "sentence-structure",
  "punctuation",
  "spelling-confused-words",
  "register-word-choice",
  "cohesion-paragraph",
] as const;

export type ReadingSkill = (typeof READING_SKILLS)[number];
export type ConventionSkill = (typeof CONVENTION_SKILLS)[number];
export type Skill = ReadingSkill | ConventionSkill;

export const DIFFICULTIES = ["easy", "standard", "challenging"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const TEST_KINDS = [
  "reading",
  "conventions",
  "mixed",
  "pitfalls",
  "exam",
] as const;
export type TestKind = (typeof TEST_KINDS)[number];

export type FeedbackMode = "practice" | "exam";
export type AppView = "setup" | "sit" | "results" | "review" | "progress";

export interface Pitfall {
  id: string;
  label: string;
}

export interface LantitePassage {
  id: string;
  title: string;
  textType: TextType;
  text: string;
}

export interface LantiteQuestion {
  id: string;
  passageId: string;
  skill: Skill;
  category: "reading" | "conventions";
  difficulty: Difficulty;
  tags: string[];
  pitfall: Pitfall | null;
  stem: string;
  options: readonly [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  optionWhy: readonly [string, string, string, string];
}

export interface TestConfig {
  kind: TestKind;
  count: QuestionCount;
  difficulty: Difficulty;
  timed: boolean;
  feedback: FeedbackMode;
  seed: number;
}

export interface TimerState {
  /** Milliseconds accumulated while the timer was not running. */
  elapsedMs: number;
  running: boolean;
  /** Epoch ms when the current running stretch started. */
  lastResumedAt: number | null;
}

export interface InProgressAttempt {
  id: string;
  config: TestConfig;
  questionIds: string[];
  answers: Record<string, number | null>;
  flagged: string[];
  currentIndex: number;
  startedAt: number;
  timer: TimerState;
  bankVersion: number;
}

export interface CompletedAttempt {
  id: string;
  config: TestConfig;
  questionIds: string[];
  answers: Record<string, number | null>;
  flagged: string[];
  startedAt: number;
  completedAt: number;
  elapsedMs: number;
  timedOut: boolean;
  bankVersion: number;
}

export interface StoreUi {
  view: AppView;
  activeAttemptId: string | null;
  reviewIndex: number;
}

export interface LantiteStore {
  version: number;
  history: CompletedAttempt[];
  inProgress: InProgressAttempt | null;
  ui: StoreUi;
}

export interface BankItem {
  question: LantiteQuestion;
  passage: LantitePassage;
}
