import { PARTICLES } from "./particles";
import { PARTICLE_VERBS } from "./verbs";
import type { ParticleLesson, ParticleQuestion } from "./types";
import { englishAlts } from "./matching";
import { formatEndingMnemonicLine } from "./mnemonics";

export const VERB_LESSON_ID = "verbs";

export function flattenVerbQuestions(): ParticleQuestion[] {
  const out: ParticleQuestion[] = [];
  for (const verb of PARTICLE_VERBS) {
    for (const form of verb.forms) {
      out.push({
        en: form.meaning,
        romaji: form.romaji,
        jp: form.jp,
        base: verb.base,
        verb: verb.meaning,
        stem: form.stem,
        ending: form.ending,
        single: true,
        alts: englishAlts(form.meaning),
        mnemonic: formatEndingMnemonicLine(form.ending, form.romaji) ?? undefined,
      });
    }
  }
  return out;
}

export function getVerbLesson(): ParticleLesson {
  return {
    id: VERB_LESSON_ID,
    title: "Main Verb Endings",
    subtitle: "Learn the useful meanings together",
    rule: "RECOGNISE THE ENDING -> KNOW THE MEANING",
    explain:
      "You already know the base verbs. Now learn the common spoken forms as a pattern system. No separate te-form test. If a form does not give you a useful meaning by itself, it is not a learning target.",
    examples: [],
    questions: flattenVerbQuestions(),
  };
}

export function getAllParticleLessons(): ParticleLesson[] {
  return [getVerbLesson(), ...PARTICLES];
}

export function getParticleLesson(id: string): ParticleLesson | undefined {
  return getAllParticleLessons().find((lesson) => lesson.id === id);
}

export const PARTICLE_LESSON_ORDER = ["verbs", "o", "ni", "de", "no", "to"] as const;