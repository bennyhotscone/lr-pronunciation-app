import type { JapaneseWord, JapaneseWordOverrideFields } from "./types";

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

/** Text passed to SpeechSynthesis — never use romaji or word.audio directly outside this helper. */
export function getAudioText(
  word: JapaneseWord,
  override?: JapaneseWordOverrideFields | null,
): string {
  return override?.ttsInput?.trim() || word.audio;
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
  return {
    id: index,
    romaji: word.r,
    english: word.en,
    defaultAudio: word.audio,
    overrideAudio: override?.ttsInput?.trim() || null,
    finalAudio,
  };
}
