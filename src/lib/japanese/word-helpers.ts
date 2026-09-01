import type { JapaneseWord, JapaneseWordOverrideFields } from "./types";

const HIRAGANA_TO_KATAKANA_OFFSET = 0x60;

/**
 * Browser TTS often blurs similar kana (e.g. スキ vs シル).
 * Kanji disambiguates pronunciation for these pairs.
 */
const TTS_KANJI_HINTS: Record<string, string> = {
  suki: "好き",
  shiru: "知る",
};

/** Hiragana to katakana so Web Speech voices pronounce distinct syllables. */
export function hiraganaToKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + HIRAGANA_TO_KATAKANA_OFFSET),
  );
}

/** Romaji overrides must not reach SpeechSynthesis. */
export function isLikelyRomaji(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /^[a-zA-Z][a-zA-Z\s'\-\u00b7.]*$/.test(t);
}

/** Normalize text for Japanese TTS - prefer katakana syllables for clarity. */
export function normalizeForJapaneseTts(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (/[\u3041-\u3096]/.test(trimmed)) {
    return hiraganaToKatakana(trimmed);
  }
  return trimmed;
}

export function getMnemonic(
  word: JapaneseWord,
  override?: JapaneseWordOverrideFields | null,
): string {
  return override?.mnemonic?.trim() || word.m;
}

export function getPronunciationCue(
  word: JapaneseWord,
  override?: JapaneseWordOverrideFields | null,
): string {
  return override?.pronunciationCue?.trim() || word.r;
}

/** Text passed to SpeechSynthesis - never use romaji or word.audio directly outside this helper. */
export function getAudioText(
  word: JapaneseWord,
  override?: JapaneseWordOverrideFields | null,
): string {
  const rawOverride = override?.ttsInput?.trim();
  if (rawOverride && !isLikelyRomaji(rawOverride)) {
    return normalizeForJapaneseTts(rawOverride);
  }
  const hinted = TTS_KANJI_HINTS[word.r];
  if (hinted) return hinted;
  return normalizeForJapaneseTts(word.audio);
}

export type PlayAudioDebugInfo = {
  id: number;
  romaji: string;
  english: string;
  defaultAudio: string;
  overrideAudio: string | null;
  finalAudio: string;
};

export function buildPlayAudioDebug(
  word: JapaneseWord,
  index: number,
  override?: JapaneseWordOverrideFields | null,
): PlayAudioDebugInfo {
  const finalAudio = getAudioText(word, override);
  const rawOverride = override?.ttsInput?.trim() || null;
  return {
    id: index,
    romaji: word.r,
    english: word.en,
    defaultAudio: word.audio,
    overrideAudio:
      rawOverride && !isLikelyRomaji(rawOverride) ? rawOverride : null,
    finalAudio,
  };
}