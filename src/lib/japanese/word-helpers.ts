import type { JapaneseWord, JapaneseWordOverrideFields } from "./types";

const HIRAGANA_TO_KATAKANA_OFFSET = 0x60;

/**
 * Browser TTS often blurs similar kana (e.g. スキ vs シル).
 * Kanji disambiguates pronunciation for these pairs.
 */
const TTS_KANJI_HINTS: Record<string, string> = {
  suki: "好き",
  shitteru: "知ってる",
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

const ROMAJI_KATAKANA: Record<string, string> = {
  a: "ア", i: "イ", u: "ウ", e: "エ", o: "オ",
  ka: "カ", ki: "キ", ku: "ク", ke: "ケ", ko: "コ",
  ga: "ガ", gi: "ギ", gu: "グ", ge: "ゲ", go: "ゴ",
  sa: "サ", shi: "シ", su: "ス", se: "セ", so: "ソ",
  za: "ザ", ji: "ジ", zu: "ズ", ze: "ゼ", zo: "ゾ",
  ta: "タ", chi: "チ", tsu: "ツ", te: "テ", to: "ト",
  da: "ダ", di: "ヂ", du: "ヅ", de: "デ", do: "ド",
  na: "ナ", ni: "ニ", nu: "ヌ", ne: "ネ", no: "ノ",
  ha: "ハ", hi: "ヒ", fu: "フ", he: "ヘ", ho: "ホ",
  ba: "バ", bi: "ビ", bu: "ブ", be: "ベ", bo: "ボ",
  pa: "パ", pi: "ピ", pu: "プ", pe: "ペ", po: "ポ",
  ma: "マ", mi: "ミ", mu: "ム", me: "メ", mo: "モ",
  ya: "ヤ", yu: "ユ", yo: "ヨ",
  ra: "ラ", ri: "リ", ru: "ル", re: "レ", ro: "ロ",
  wa: "ワ", wo: "ヲ", n: "ン",
  kya: "キャ", kyu: "キュ", kyo: "キョ",
  gya: "ギャ", gyu: "ギュ", gyo: "ギョ",
  sha: "シャ", shu: "シュ", sho: "ショ",
  ja: "ジャ", ju: "ジュ", jo: "ジョ",
  cha: "チャ", chu: "チュ", cho: "チョ",
  nya: "ニャ", nyu: "ニュ", nyo: "ニョ",
  hya: "ヒャ", hyu: "ヒュ", hyo: "ヒョ",
  bya: "ビャ", byu: "ビュ", byo: "ビョ",
  pya: "ピャ", pyu: "ピュ", pyo: "ピョ",
  mya: "ミャ", myu: "ミュ", myo: "ミョ",
  rya: "リャ", ryu: "リュ", ryo: "リョ",
  ou: "オウ", you: "ヨウ",
};

const ROMAJI_SYLLABLES = Object.keys(ROMAJI_KATAKANA).sort((a, b) => b.length - a.length);

function isRomajiVowel(ch: string): boolean {
  return "aeiou".includes(ch);
}

function convertRomajiWord(word: string): string {
  const s = word
    .toLowerCase()
    .replace(/ā/g, "aa")
    .replace(/ī/g, "ii")
    .replace(/ū/g, "uu")
    .replace(/ē/g, "ee")
    .replace(/ō/g, "ou");

  let result = "";
  let i = 0;
  while (i < s.length) {
    if (i + 1 < s.length && s[i] === s[i + 1] && !isRomajiVowel(s[i]) && s[i] !== "n") {
      result += "ッ";
      i += 1;
      continue;
    }

    if (s[i] === "n") {
      if (i + 1 < s.length && s[i + 1] === "n") {
        result += "ン";
        i += 2;
        continue;
      }
      if (i + 1 === s.length || !isRomajiVowel(s[i + 1])) {
        result += "ン";
        i += 1;
        continue;
      }
    }

    let matched = false;
    for (const syllable of ROMAJI_SYLLABLES) {
      if (s.startsWith(syllable, i)) {
        result += ROMAJI_KATAKANA[syllable];
        i += syllable.length;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1;
  }
  return result;
}

/** Build full-katakana TTS text from stored romaji (avoids kanji misreadings like 食 -> shoku). */
export function romajiToKatakana(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map(convertRomajiWord)
    .join("");
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