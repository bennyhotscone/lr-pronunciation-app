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
  formMC: "2. Hear form -> choose meaning",
  verbMC: "3. Mixed verbs -> choose meaning",
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

export function meaningChoices(
  question: ParticleQuestion,
  pool: ParticleQuestion[],
  restrictSameVerb: boolean,
): string[] {
  const candidates = pool.filter(
    (q) => q !== question && (!restrictSameVerb || q.base === question.base),
  );
  const meanings = [question.en];
  for (const candidate of shuffle(candidates)) {
    if (!meanings.some((m) => normalizeParticleText(m) === normalizeParticleText(candidate.en))) {
      meanings.push(candidate.en);
    }
    if (meanings.length >= 8) break;
  }
  return shuffle(meanings);
}

export function buildTiles(lesson: ParticleLesson, question: ParticleQuestion): string[] {
  if (lesson.id === VERB_LESSON_ID) {
    const same = lesson.questions
      .filter((q) => q.base === question.base)
      .map((q) => q.romaji);
    const other = shuffle(
      lesson.questions.filter((q) => q.base !== question.base).map((q) => q.romaji),
    ).slice(0, 3);
    const merged = shuffle([...new Set([...same, ...other])]);
    if (!merged.includes(question.romaji)) merged.unshift(question.romaji);
    return merged.slice(0, 12);
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