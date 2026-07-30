export type LearnerLanguage = "ja" | "th" | "other";

export type ProgressState = {
  version: 1;
  language: LearnerLanguage;
  currentSequence: number;
  listening: {
    attempts: number;
    correct: number;
    confusedPairIds: Record<string, number>;
  };
  speaking: {
    attempts: number;
  };
};

export const DEFAULT_PROGRESS: ProgressState = {
  version: 1,
  language: "other",
  currentSequence: 1,
  listening: {
    attempts: 0,
    correct: 0,
    confusedPairIds: {},
  },
  speaking: {
    attempts: 0,
  },
};

export const PROGRESS_STORAGE_KEY = "lor-progress-v1";
