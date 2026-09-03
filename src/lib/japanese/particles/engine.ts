import type {
  ParticleBlockMeta,
  ParticleLesson,
  ParticleQuestion,
  ParticleRoundId,
  ParticleSessionState,
} from "./types";
import { VERB_LESSON_ID } from "./lessons";
import {
  acceptedEnglish,
  englishAlts,
  matchParticleRomaji,
  matchParticleSentence,
  normalizeParticleText,
} from "./matching";
import { getParticleAudioText } from "./audio";

export const PARTICLE_ROUND_ORDER: ParticleRoundId[] = [
  "teach",
  "formMC",
  "verbMC",
  "build",
  "listenType",
  "typeRomaji",
];

export const PARTICLE_ROUND_LABELS: Record<ParticleRoundId, string> = {
  teach: "1. See the patterns",
  formMC: "2. Same verb, different endings",
  verbMC: "3. Different verbs, same ending",
  build: "4. Build / choose Japanese",
  listenType: "5. Hear Japanese -> type English",
  typeRomaji: "6. English -> type romaji",
};

export function createInitialParticleSession(): ParticleSessionState {
  return {
    round: "teach",
    questionIndex: 0,
    score: 0,
    verbTabIndex: 0,
  };
}

export function createInitialParticleMeta(): ParticleBlockMeta {
  return {
    mastered: false,
    teachSeen: false,
    roundsCompleted: [],
  };
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export {
  acceptedEnglish,
  englishAlts,
  matchParticleRomaji,
  matchParticleSentence,
  normalizeParticleText,
};

export type FormRomajiChoice = {
  romaji: string;
  en?: string;
  jp?: string;
};

export type McChoice = {
  key: string;
  romaji: string;
  en: string;
  base: string;
};

export function questionJapaneseAudio(question: ParticleQuestion): string {
  return getParticleAudioText({
    jp: question.jp,
    romaji: question.romaji,
    en: question.en,
  });
}

export function formatVerbFormLabel(question: ParticleQuestion): string {
  const base = question.base?.trim() ?? "";
  const romaji = question.romaji?.trim() ?? "";
  const meaning = question.en?.trim() ?? "";
  if (base && romaji) {
    return meaning ? `${base} -> ${romaji} - ${meaning}` : `${base} -> ${romaji}`;
  }
  if (romaji && meaning) return `${romaji} - ${meaning}`;
  return romaji || meaning || "";
}

function toMcChoice(question: ParticleQuestion): McChoice {
  return {
    key: question.romaji,
    romaji: question.romaji,
    en: question.en,
    base: question.base ?? "",
  };
}

export function formRomajiChoices(
  question: ParticleQuestion,
  pool: ParticleQuestion[],
  restrictSameVerb: boolean,
): FormRomajiChoice[] {
  const candidates = pool.filter(
    (q) => q !== question && (!restrictSameVerb || q.base === question.base),
  );
  const choices: FormRomajiChoice[] = [
    { romaji: question.romaji, en: question.en, jp: question.jp },
  ];
  for (const candidate of shuffle(candidates)) {
    if (
      !choices.some(
        (choice) =>
          normalizeParticleText(choice.romaji) === normalizeParticleText(candidate.romaji),
      )
    ) {
      choices.push({ romaji: candidate.romaji, en: candidate.en, jp: candidate.jp });
    }
    if (choices.length >= 8) break;
  }
  return shuffle(choices);
}

export function mcChoices(
  question: ParticleQuestion,
  pool: ParticleQuestion[],
  mode: "form" | "verb",
): McChoice[] {
  if (mode === "form") {
    return formRomajiChoices(question, pool, true).map((choice) => ({
      key: choice.romaji,
      romaji: choice.romaji,
      en: choice.en ?? "",
      base: question.base ?? "",
    }));
  }
  const ending = question.ending ?? "";
  const candidates = pool.filter(
    (q) => q !== question && (ending ? q.ending === ending : q.base !== question.base),
  );
  const choices: McChoice[] = [toMcChoice(question)];
  for (const candidate of shuffle(candidates)) {
    if (!choices.some((choice) => choice.romaji === candidate.romaji)) {
      choices.push(toMcChoice(candidate));
    }
    if (choices.length >= 8) break;
  }
  return shuffle(choices);
}

export function meaningChoices(
  question: ParticleQuestion,
  pool: ParticleQuestion[],
  restrictSameVerb: boolean,
): string[] {
  const mode = restrictSameVerb ? "form" : "verb";
  return mcChoices(question, pool, mode).map((choice) => choice.en);
}

export function buildTiles(lesson: ParticleLesson, question: ParticleQuestion): string[] {
  if (lesson.id === VERB_LESSON_ID) {
    const same = lesson.questions
      .filter((q) => q.base === question.base)
      .map((q) => q.romaji);
    const other = shuffle(
      lesson.questions.filter((q) => q.base !== question.base).map((q) => q.romaji),
    ).slice(0, 3);
    const pool = [...new Set([...same, ...other])];
    const distractors = shuffle(pool.filter((romaji) => romaji !== question.romaji)).slice(0, 11);
    return shuffle([question.romaji, ...distractors]);
  }
  return shuffle(question.tiles ?? []);
}

export function isVerbLesson(lesson: ParticleLesson): boolean {
  return lesson.id === VERB_LESSON_ID;
}

export function getRequiredRoundsForLesson(lessonId: string): ParticleRoundId[] {
  if (lessonId === VERB_LESSON_ID) return [...PARTICLE_ROUND_ORDER];
  return ["teach", "build", "listenType", "typeRomaji"];
}

export function getEffectiveRound(lessonId: string, round: ParticleRoundId): ParticleRoundId {
  if (lessonId === VERB_LESSON_ID) return round;
  if (round === "formMC" || round === "verbMC") return "build";
  return round;
}

export function markRoundCompleted(meta: ParticleBlockMeta, round: ParticleRoundId): ParticleBlockMeta {
  const roundsCompleted = meta.roundsCompleted.includes(round)
    ? meta.roundsCompleted
    : [...meta.roundsCompleted, round];
  const teachSeen = round === "teach" ? true : meta.teachSeen;
  return { ...meta, roundsCompleted, teachSeen };
}

export function updateMetaAfterRound(
  meta: ParticleBlockMeta,
  lessonId: string,
  round: ParticleRoundId,
  score: number,
  total: number,
): ParticleBlockMeta {
  const next = markRoundCompleted(meta, round);
  const required = getRequiredRoundsForLesson(lessonId);
  const mastered = required.every((r) => next.roundsCompleted.includes(r)) && total > 0 && score >= total;
  return { ...next, mastered };
}