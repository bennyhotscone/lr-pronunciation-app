import { playWordAudio } from "../tts";
import {
  isLikelyRomaji,
  normalizeForJapaneseTts,
  romajiToKatakana,
  type PlayAudioDebugInfo,
} from "../word-helpers";
import { PARTICLE_VERBS } from "./verbs";

export type ParticleAudioSource = {
  jp: string;
  romaji: string;
  en?: string;
};

const HAS_KANJI = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const KATAKANA_MORA =
  /(?:[\u30ad\u30b7\u30c1\u30cb\u30d2\u30df\u30ea\u30ae\u30b8\u30d3\u30d4][\u30e3\u30e5\u30e7])|(?:\u30c3)|(?:[\u30a1-\u30f6\u30fc])/gu;

function splitKatakanaMorae(text: string): string[] {
  return text.match(KATAKANA_MORA) ?? (text ? Array.from(text) : []);
}

/** Web Speech blurs bare short katakana (MITA->mama). Mora dots force syllables. */
export function particleKanaForTts(katakana: string): string {
  const kana = katakana.trim();
  if (!kana) return "";
  const morae = splitKatakanaMorae(kana);
  if (morae.length === 0) return "";
  if (morae.length <= 3) return morae.join("\u30fb") + "\u3002";
  return kana + "\u3002";
}

export function resolveParticleAudioSource(source: ParticleAudioSource): ParticleAudioSource {
  const romaji = source.romaji.trim();
  if (!romaji) return source;
  for (const verb of PARTICLE_VERBS) {
    const form = verb.forms.find((entry) => entry.romaji === romaji);
    if (form) return { ...source, jp: form.jp, romaji: form.romaji, en: source.en ?? form.meaning };
  }
  return source;
}

/** Prefer romaji->katakana. Never send kanji (mita as mixed kanji sounds like mama). */
export function getParticleAudioText(source: ParticleAudioSource): string {
  const resolved = resolveParticleAudioSource(source);
  const jp = resolved.jp.trim();
  const romaji = resolved.romaji.trim();
  if (romaji) return particleKanaForTts(romajiToKatakana(romaji));
  if (!jp || isLikelyRomaji(jp) || HAS_KANJI.test(jp)) return "";
  return particleKanaForTts(normalizeForJapaneseTts(jp));
}

export function buildParticleAudioDebug(source: ParticleAudioSource, id = 0): PlayAudioDebugInfo {
  const resolved = resolveParticleAudioSource(source);
  const finalAudio = getParticleAudioText(resolved);
  return { id, romaji: resolved.romaji, english: resolved.en ?? "", defaultAudio: resolved.jp, overrideAudio: null, finalAudio };
}

export function playParticleAudio(source: ParticleAudioSource, id = 0): void {
  const resolved = resolveParticleAudioSource(source);
  const finalAudio = getParticleAudioText(resolved);
  if (!finalAudio) return;
  playWordAudio(finalAudio, buildParticleAudioDebug(resolved, id));
}
