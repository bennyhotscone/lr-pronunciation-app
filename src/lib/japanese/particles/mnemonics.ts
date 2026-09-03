/** Plain-English memory hooks for verb endings (particle / grammar round). */

export type VerbEndingMnemonic = {
  sound: string;
  hint: string;
};

/** Lookup by ending key (e.g. "katta", "nai"). */
export const VERB_ENDING_MNEMONICS: Record<string, VerbEndingMnemonic> = {
  u: { sound: "oo", hint: "dictionary form - do it" },
  ru: { sound: "roo", hint: "do it (ichidan)" },
  masu: { sound: "mask", hint: "polite mask - do politely" },
  mashita: { sound: "mash did it", hint: "polite past - did it politely" },
  masen: { sound: "mask no", hint: "polite no - don't do" },
  masendeshita: { sound: "mask didn't", hint: "polite didn't - didn't do" },
  nai: { sound: "nope", hint: "don't / won't do" },
  nakatta: { sound: "nah cutter", hint: "didn't do (past)" },
  te: { sound: "teh", hint: "connective - and then" },
  ta: { sound: "tah", hint: "did it (past)" },
  katta: { sound: "cutter", hint: "cut it - past (u-verbs)" },
  ita: { sound: "eat ah", hint: "did it - past (ru-verbs)" },
  shita: { sound: "she did it", hint: "did it - past (suru)" },
  nda: { sound: "ended", hint: "ended - past (mu/bu/nu/gu)" },
  sou: { sound: "so", hint: "looks like / seems" },
  tai: { sound: "tie", hint: "want to" },
  taku: { sound: "tah-koo", hint: "want to (stem)" },
  takunai: { sound: "tah-koo nope", hint: "don't want to" },
  takatta: { sound: "tah cutter", hint: "wanted to (past)" },
  takunakatta: { sound: "tah-koo nah cutter", hint: "didn't want to (past)" },
};

const ROMAJI_SUFFIX_MNEMONICS: Array<{ suffix: string } & VerbEndingMnemonic> = [
  { suffix: "takunakatta", sound: "tah-koo nah cutter", hint: "didn't want to (past)" },
  { suffix: "itakunakatta", sound: "tah-koo nah cutter", hint: "didn't want to (past)" },
  { suffix: "masendeshita", sound: "mask didn't", hint: "polite didn't" },
  { suffix: "takunai", sound: "tah-koo nope", hint: "don't want to" },
  { suffix: "itakunai", sound: "tah-koo nope", hint: "don't want to" },
  { suffix: "nakatta", sound: "nah cutter", hint: "didn't (past)" },
  { suffix: "mashita", sound: "mash did it", hint: "polite past" },
  { suffix: "takatta", sound: "tah cutter", hint: "wanted to (past)" },
  { suffix: "itakatta", sound: "tah cutter", hint: "wanted to (past)" },
  { suffix: "katta", sound: "cutter", hint: "cut it - past (u-verbs)" },
  { suffix: "shita", sound: "she did it", hint: "did it - past (suru)" },
  { suffix: "ita", sound: "eat ah", hint: "did it - past (ru-verbs)" },
  { suffix: "nda", sound: "ended", hint: "ended - past" },
  { suffix: "masu", sound: "mask", hint: "polite mask" },
  { suffix: "masen", sound: "mask no", hint: "polite no" },
  { suffix: "te", sound: "teh", hint: "connective - and then" },
  { suffix: "nai", sound: "nope", hint: "don't / won't" },
  { suffix: "ta", sound: "tah", hint: "did it (past)" },
];

function normalizeEnding(ending?: string): string {
  return (ending ?? "").trim().toLowerCase().replace(/^-+/, "");
}

export function getVerbEndingMnemonic(
  ending?: string,
  romaji?: string,
): VerbEndingMnemonic | undefined {
  const key = normalizeEnding(ending);
  if (key && VERB_ENDING_MNEMONICS[key]) return VERB_ENDING_MNEMONICS[key];

  const r = (romaji ?? "").trim().toLowerCase();
  if (!r) return undefined;

  for (const entry of ROMAJI_SUFFIX_MNEMONICS) {
    if (r.endsWith(entry.suffix)) {
      return { sound: entry.sound, hint: entry.hint };
    }
  }
  return undefined;
}

export function formatEndingMnemonicLine(ending?: string, romaji?: string): string | null {
  const m = getVerbEndingMnemonic(ending, romaji);
  if (!m) return null;
  const label = normalizeEnding(ending) || romaji?.trim().toLowerCase() || "";
  const prefix = label ? `-${label} -> ` : "";
  return `${prefix}${m.sound} - ${m.hint}`;
}

export function formatEndingMnemonicShort(ending?: string, romaji?: string): string | null {
  const m = getVerbEndingMnemonic(ending, romaji);
  return m ? m.sound : null;
}