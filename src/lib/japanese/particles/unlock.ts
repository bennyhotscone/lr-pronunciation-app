import { JAPANESE_ALWAYS_UNLOCKED_BLOCKS } from "../config";
import type { ParticleBlockMeta, ParticleRoundId } from "./types";
import { PARTICLE_ROUND_ORDER, getRequiredRoundsForLesson, getEffectiveRound } from "./engine";
import { PARTICLE_LESSON_ORDER, VERB_LESSON_ID } from "./lessons";

export function hasParticleVocabularyAccess(
  block3Mastered: boolean,
  maxUnlockedJapaneseBlock: number,
): boolean {
  return (
    block3Mastered ||
    maxUnlockedJapaneseBlock >= 3 ||
    JAPANESE_ALWAYS_UNLOCKED_BLOCKS >= 3
  );
}

export function isParticleLessonAccessible(
  lessonId: string,
  block3Mastered: boolean,
  maxUnlockedJapaneseBlock: number,
  masteredByLesson: Record<string, boolean>,
): boolean {
  if (!hasParticleVocabularyAccess(block3Mastered, maxUnlockedJapaneseBlock)) return false;
  const idx = PARTICLE_LESSON_ORDER.indexOf(lessonId as (typeof PARTICLE_LESSON_ORDER)[number]);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const previousId = PARTICLE_LESSON_ORDER[idx - 1];
  return masteredByLesson[previousId] === true;
}

export function isParticleRoundAccessible(
  round: ParticleRoundId,
  meta: ParticleBlockMeta,
  lessonId: string,
  block3Mastered: boolean,
  maxUnlockedJapaneseBlock: number,
): boolean {
  if (!hasParticleVocabularyAccess(block3Mastered, maxUnlockedJapaneseBlock)) return false;

  const effective = getEffectiveRound(lessonId, round);
  if (lessonId !== VERB_LESSON_ID && (round === "formMC" || round === "verbMC")) {
    return false;
  }

  if (effective === "teach") return true;
  if (!meta.teachSeen) return false;

  const requiredBefore = getRequiredRoundsForLesson(lessonId);
  const targetIndex = PARTICLE_ROUND_ORDER.indexOf(effective);
  for (let i = 0; i < targetIndex; i++) {
    const step = PARTICLE_ROUND_ORDER[i];
    if (!requiredBefore.includes(step)) continue;
    if (step === "teach" && meta.teachSeen) continue;
    if (step === "teach") {
      if (!meta.teachSeen) return false;
      continue;
    }
    if (!meta.roundsCompleted.includes(step)) return false;
  }
  return true;
}