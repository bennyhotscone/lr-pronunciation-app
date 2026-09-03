export type ParticleRoundId =
  | "teach"
  | "formMC"
  | "verbMC"
  | "build"
  | "listenType"
  | "typeRomaji";

export type ParticleExample = {
  romaji: string;
  jp: string;
  en: string;
};

export type ParticleQuestion = {
  en: string;
  romaji: string;
  jp: string;
  tiles?: string[];
  base?: string;
  verb?: string;
  stem?: string;
  ending?: string;
  single?: boolean;
  alts?: string[];
};

export type VerbFormEntry = {
  romaji: string;
  jp: string;
  meaning: string;
  stem: string;
  ending: string;
};

export type VerbEntry = {
  base: string;
  jp: string;
  meaning: string;
  family: string;
  stem: string;
  forms: VerbFormEntry[];
};

export type ParticleLesson = {
  id: string;
  title: string;
  subtitle: string;
  rule: string;
  explain: string;
  examples: ParticleExample[];
  questions: ParticleQuestion[];
};

export type ParticleSessionState = {
  round: ParticleRoundId;
  questionIndex: number;
  score: number;
  verbTabIndex: number;
};

export type ParticleBlockMeta = {
  mastered: boolean;
  teachSeen: boolean;
  roundsCompleted: ParticleRoundId[];
};