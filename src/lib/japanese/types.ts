export type JapaneseWord = {
  jp: string;
  audio: string;
  r: string;
  en: string;
  m: string;
};

export type JapanesePhase = "round1" | "round2" | "round3" | "round4" | "round5";

export type JapaneseSessionState = {
  phase: JapanesePhase;
  introIndex: number;
  miniQueue: number[];
  miniIndex: number;
  inMini: boolean;
  order: number[];
  qIndex: number;
  score: number;
  missed: number[];
};

export type JapaneseBlockMeta = {
  roundScores: Partial<Record<"2" | "3" | "4" | "5", number>>;
  bestRound5Score: number;
  blockMastered: boolean;
  unlockedBlocks: number[];
};

export type JapaneseWordOverrideFields = {
  mnemonic?: string | null;
  pronunciationCue?: string | null;
  ttsInput?: string | null;
};

export type ResolvedJapaneseWord = JapaneseWord & {
  index: number;
  displayMnemonic: string;
  displayRomaji: string;
  speakText: string;
};

export type JapaneseRoundView =
  | {
      kind: "round1-new";
      wordIndex: number;
      counter: string;
      roundLabel: string;
      instruction: string;
      mnemonicHtml: string;
      showMnemonic: true;
      choicePool: number[];
      progressPct: number;
    }
  | {
      kind: "round1-mini";
      wordIndex: number;
      counter: string;
      roundLabel: string;
      instruction: string;
      mnemonicHtml: string;
      showMnemonic: true;
      choicePool: number[];
      progressPct: number;
    }
  | {
      kind: "formal";
      wordIndex: number;
      round: 2 | 3 | 4 | 5;
      counter: string;
      roundLabel: string;
      instruction: string;
      showMnemonic: boolean;
      mnemonicHtml?: string;
      showPronunciationCue?: boolean;
      pronunciationCue?: string;
      choicePool: number[];
      progressPct: number;
      scoreLabel: string;
      mode: "choices" | "type-english" | "type-romaji";
      promptEnglish?: string;
    }
  | {
      kind: "round-complete";
      round: 1 | 2 | 3 | 4 | 5;
      scorePct: number;
      passed: boolean;
      missedIndices: number[];
      progressPct: number;
      nextRound?: 2 | 3 | 4 | 5;
      retryRound?: 2 | 3 | 4 | 5;
      blockMastered?: boolean;
    };
