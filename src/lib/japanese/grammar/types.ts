export type GrammarPhase = "teach" | "guided" | "recall";

export type GrammarExample = {
  jp: string;
  romaji: string;
  en: string;
  breakdown: string;
};

export type GrammarTeachContent = {
  title: string;
  summary: string;
  sections: { heading: string; body: string }[];
  examples: GrammarExample[];
};

export type GrammarMcQuestion = {
  kind: "mc";
  prompt: string;
  choices: string[];
  answerIndex: number;
  hint?: string;
};

export type GrammarFillQuestion = {
  kind: "fill";
  prompt: string;
  before: string;
  after: string;
  answers: string[];
  hint?: string;
};

export type GrammarReorderQuestion = {
  kind: "reorder";
  prompt: string;
  words: string[];
  answer: string;
  hint?: string;
};

export type GrammarBuildQuestion = {
  kind: "build";
  prompt: string;
  bank: string[];
  answer: string;
  hint?: string;
};

export type GrammarGuidedQuestion =
  | GrammarMcQuestion
  | GrammarFillQuestion
  | GrammarReorderQuestion
  | GrammarBuildQuestion;

export type GrammarRecallQuestion = {
  id: string;
  direction: "j-to-e" | "e-to-j";
  promptJp?: string;
  promptRomaji?: string;
  promptEn?: string;
  audio?: string;
  answers: string[];
  romajiAnswers?: string[];
};

export type GrammarBlock = {
  id: string;
  title: string;
  order: number;
  teach: GrammarTeachContent;
  guided: GrammarGuidedQuestion[];
  recall: GrammarRecallQuestion[];
};

export type GrammarSessionState = {
  phase: GrammarPhase;
  guidedIndex: number;
  recallIndex: number;
  recallMode: "j-to-e" | "e-to-j" | "mixed";
  score: number;
  missed: string[];
};

export type GrammarBlockMeta = {
  teachCompleted: boolean;
  guidedCompleted: boolean;
  recallJtoECompleted: boolean;
  recallEtoJCompleted: boolean;
  mastered: boolean;
  unlockedBlocks: string[];
};
