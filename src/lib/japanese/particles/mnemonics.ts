/** Plain-English memory hooks for verb endings + verb groups (grammar round). */

export type VerbEndingMnemonic = {
  /** Default sound hook (also options[0]). */
  sound: string;
  /** Short plain-English meaning (legacy field; same as meaning). */
  hint: string;
  /** Plain English: what this ending does. No grammar jargon. */
  meaning: string;
  /** 2–3 suggested sound hooks the learner can pick from. */
  options: string[];
};

export type VerbGroupId = "cut-before" | "last-sound" | "special";

export type VerbGroupInfo = {
  id: VerbGroupId;
  /** Spoken-English title (no ichidan/godan). */
  title: string;
  /** One-line how-it-works. */
  explain: string;
  /** Short memory hook for the pattern. */
  mnemonic: string;
  /** Example bases. */
  examples: string[];
  /** Matches VerbEntry.family strings. */
  families: string[];
};

function entry(
  meaning: string,
  options: [string, string] | [string, string, string],
): VerbEndingMnemonic {
  return { sound: options[0], hint: meaning, meaning, options: [...options] };
}

/** Lookup by ending key (e.g. "katta", "nai", "takunakatta"). */
export const VERB_ENDING_MNEMONICS: Record<string, VerbEndingMnemonic> = {
  // Dictionary / base
  u: entry("plain form — just do it / will do it", ["oo — do it", "ooh — the base form", "u like 'do'"]),
  ru: entry("plain form — just do it (cut-before verbs)", ["roo — do it", "rue — the base ending", "ru = ready to use"]),
  suru: entry("do / make (special verb)", ["sue-roo — just do it", "siru → do", "su-ru = pursue doing"]),
  kuru: entry("come (special verb)", ["koo-roo — come through", "crew — come along", "ku-ru = come through"]),

  // Polite
  masu: entry("polite — do it politely", ["mask — polite mask on", "mah-sue — polite do", "masu = must be polite"]),
  mashita: entry("polite past — did it politely", ["mash did it — polite past", "mah-she-tah — polite did", "mashed it (politely)"]),
  masen: entry("polite don't — don't do (polite)", ["mask no — polite no", "mah-sen — polite don't", "mason says no (polite)"]),
  masendeshita: entry("polite didn't — didn't do (polite)", ["mask didn't — polite past no", "mah-sen-desh-tah — polite didn't", "mason didn't (polite)"]),

  // Don't / didn't
  nai: entry("don't / won't do", ["nope — don't", "nigh — like 'deny'", "nai = nay (no)"]),
  anai: entry("don't / won't do", ["ah-nope — don't", "ah-nigh — deny it", "anai = a nay"]),
  nakatta: entry("didn't do (past)", ["nah cutter — cut it out, past", "nah-KATTA — no + past cutter", "nakatta = not cutter (didn't)"]),
  anakatta: entry("didn't do (past)", ["ah-nah cutter — didn't", "ah-nah-KATTA — no + past", "anakatta = a not cutter"]),

  // Past
  ta: entry("did it (past)", ["tah — did it", "ta like 'done'", "tah = past stamp"]),
  da: entry("did it (past)", ["dah — did it", "da like 'done'", "dah = past stamp"]),
  katta: entry("did it (past) — last-sound verbs", ["cutter — cut it (past)", "KATTA — cut past", "caught-ah — already done"]),
  ita: entry("did it (past) — cut-before verbs", ["eat-ah — did it", "ee-tah — past", "ita = eat-ah done"]),
  shita: entry("did it (past) — suru", ["she did it — past do", "she-tah — did", "shita = she did"]),
  nda: entry("did it (past) — drink/go-type sounds", ["ended — past done", "n-dah — ended", "nda = ended"]),

  // Connective / ongoing
  te: entry("and then / connecting form", ["teh — and then", "teh like 'take next'", "te = tether to next"]),
  teru: entry("doing it now / is ~ing", ["teh-roo — doing now", "teru = tearing into it now", "teh-ru — in progress"]),
  deru: entry("doing it now / is ~ing", ["deh-roo — doing now", "deru = daring to do it now", "deh-ru — in progress"]),

  // Want
  tai: entry("want to", ["tie — tied to wanting", "tie it — I want it", "tai = tie (want)"]),
  itai: entry("want to", ["ee-tie — want to", "itai = I tie (want)", "ee-tai — want"]),
  taku: entry("want-to stem (before don't/past)", ["tah-koo — want stem", "taku = taco of wanting", "tah-koo — want base"]),
  takunai: entry("don't want to", ["tah-koo nope — don't want", "tah-koo-NIGH — want shut off", "takunai = taco nay"]),
  itakunai: entry("don't want to", ["ee-tah-koo nope — don't want", "ee-tah-koo-NIGH — want off", "itakunai = I taco nay"]),
  takatta: entry("wanted to (past)", ["tah cutter — wanted (past)", "tah-KATTA — wanted cut past", "takatta = taco cutter (wanted)"]),
  itakatta: entry("wanted to (past)", ["ee-tah cutter — wanted (past)", "ee-tah-KATTA — wanted past", "itakatta = I taco cutter"]),
  takunakatta: entry("didn't want to (past)", ["tah-koo nah cutter — didn't want (past)", "tah-koo-nah-KATTA — want cut out past", "takunakatta = taco nah cutter"]),
  itakunakatta: entry("didn't want to (past)", ["ee-tah-koo nah cutter — didn't want (past)", "ee-tah-koo-nah-KATTA — want out past", "itakunakatta = I taco nah cutter"]),

  // Can / let's
  rareru: entry("can / able to", ["rah-reh-roo — can do it", "rareru = rare ability", "rah-REH-ru — able"]),
  eru: entry("can / able to (last-sound verbs)", ["eh-roo — can do it", "eru = air you can", "eh-ru — able"]),
  dekiru: entry("can do (from suru)", ["day-kee-roo — can do", "dekiru = deck hero can", "DAY-kee-ru — able to do"]),
  you: entry("let's ~", ["yoh — let's go do it", "you = yo, let's", "yoh — invitation"]),
  ou: entry("let's ~ (last-sound verbs)", ["oh — let's", "ou = oh, let's", "oh — invitation"]),
  sou: entry("looks like / seems", ["so — seems so", "sou = so it seems", "soh — looks like"]),
};

/** Longest-first romaji suffix fallbacks when ending key is missing. */
const ROMAJI_SUFFIX_KEYS: string[] = Object.keys(VERB_ENDING_MNEMONICS).sort(
  (a, b) => b.length - a.length,
);

export const VERB_GROUPS: Record<VerbGroupId, VerbGroupInfo> = {
  "cut-before": {
    id: "cut-before",
    title: "Cut-before verbs",
    explain:
      "Ends with -iru / -eru like taberu (eat) or miru (see). Cut off that ending, keep the front, then stick on a new ending — tabe + nai = tabenai (don't eat).",
    mnemonic: "Peel the -ru, stick a new ending on.",
    examples: ["taberu", "miru"],
    families: ["easy -ru pattern"],
  },
  "last-sound": {
    id: "last-sound",
    title: "Last-sound verbs",
    explain:
      "Most other verbs like nomu (drink) or iku (go). The last sound changes when you add endings — nomu → nomanai (don't drink), nomu → nonda (drank).",
    mnemonic: "Swap the last sound, then add the ending.",
    examples: ["nomu", "iku"],
    families: ["-u pattern"],
  },
  special: {
    id: "special",
    title: "Special pair",
    explain:
      "suru (do) and kuru (come) break the usual patterns. Learn their forms as a small set — shinai, shita, konai, kita — and don't force a rule.",
    mnemonic: "suru + kuru: just memorize the pair.",
    examples: ["suru", "kuru"],
    families: ["special"],
  },
};

export const VERB_GROUP_LIST: VerbGroupInfo[] = [
  VERB_GROUPS["cut-before"],
  VERB_GROUPS["last-sound"],
  VERB_GROUPS.special,
];

function normalizeEnding(ending?: string): string {
  return (ending ?? "").trim().toLowerCase().replace(/^-+/, "");
}

export function resolveEndingKey(ending?: string, romaji?: string): string | undefined {
  const key = normalizeEnding(ending);
  if (key && VERB_ENDING_MNEMONICS[key]) return key;

  const r = (romaji ?? "").trim().toLowerCase();
  if (!r) return key || undefined;

  for (const suffix of ROMAJI_SUFFIX_KEYS) {
    if (r.endsWith(suffix) && VERB_ENDING_MNEMONICS[suffix]) return suffix;
  }
  return key || undefined;
}

export function getVerbEndingMnemonic(
  ending?: string,
  romaji?: string,
): VerbEndingMnemonic | undefined {
  const key = resolveEndingKey(ending, romaji);
  if (!key) return undefined;
  return VERB_ENDING_MNEMONICS[key];
}

export function getVerbGroupForFamily(family?: string): VerbGroupInfo | undefined {
  const f = (family ?? "").trim();
  if (!f) return undefined;
  return VERB_GROUP_LIST.find((g) => g.families.includes(f));
}

export function getVerbGroupById(id: VerbGroupId): VerbGroupInfo {
  return VERB_GROUPS[id];
}

export function formatEndingMnemonicLine(
  ending?: string,
  romaji?: string,
  selectedSound?: string | null,
): string | null {
  const m = getVerbEndingMnemonic(ending, romaji);
  if (!m) return null;
  const key = resolveEndingKey(ending, romaji) || normalizeEnding(ending) || romaji?.trim().toLowerCase() || "";
  const sound = (selectedSound && selectedSound.trim()) || m.sound;
  const prefix = key ? `-${key} → ` : "";
  return `${prefix}${sound} — ${m.meaning}`;
}

export function formatEndingMnemonicShort(
  ending?: string,
  romaji?: string,
  selectedSound?: string | null,
): string | null {
  const m = getVerbEndingMnemonic(ending, romaji);
  if (!m) return null;
  return (selectedSound && selectedSound.trim()) || m.sound;
}

export function listTeachEndingKeys(): string[] {
  return [
    "ru",
    "u",
    "nai",
    "anai",
    "ta",
    "da",
    "nakatta",
    "anakatta",
    "tai",
    "itai",
    "takunai",
    "itakunai",
    "takatta",
    "itakatta",
    "takunakatta",
    "itakunakatta",
    "teru",
    "deru",
    "rareru",
    "eru",
    "dekiru",
    "you",
    "ou",
    "suru",
    "kuru",
  ];
}