import { playWordAudio } from "../tts";
import {
  isLikelyRomaji,
  normalizeForJapaneseTts,
  type PlayAudioDebugInfo,
} from "../word-helpers";

export type ParticleAudioSource = {
  jp: string;
  romaji: string;
  en?: string;
};

/** Resolve Japanese script for TTS — never pass romaji to SpeechSynthesis. */
export function getParticleAudioText(source: ParticleAudioSource): string {
  const jp = source.jp.trim();
  if (jp && !isLikelyRomaji(jp)) {
    return normalizeForJapaneseTts(jp);
  }
  return "";
}

export function buildParticleAudioDebug(
  source: ParticleAudioSource,
  id = 0,
): PlayAudioDebugInfo {
  const finalAudio = getParticleAudioText(source);
  return {
    id,
    romaji: source.romaji,
    english: source.en ?? "",
    defaultAudio: source.jp,
    overrideAudio: null,
    finalAudio,
  };
}

export function playParticleAudio(source: ParticleAudioSource, id = 0): void {
  const finalAudio = getParticleAudioText(source);
  if (!finalAudio) return;
  playWordAudio(finalAudio, buildParticleAudioDebug(source, id));
}