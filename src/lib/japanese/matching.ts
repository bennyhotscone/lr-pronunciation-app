import type { JapaneseWord } from "./types";

export function normalizeEnglish(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ENGLISH_EXTRAS: Record<string, string[]> = {
  "I / me": ["i", "me"],
  "return / go home": ["return", "go home", "come home", "return home"],
  "see / watch": ["see", "watch"],
  "listen / ask": ["listen", "hear", "ask"],
  "speak / talk": ["speak", "talk"],
  "can / be able": ["can", "be able", "able"],
  "receive / get": ["receive", "get"],
  "rest / take off": ["rest", "take off", "take a break"],
  "expensive / high": ["expensive", "high"],
  "early / fast": ["early", "fast", "quick"],
  "late / slow": ["late", "slow"],
  "fun / enjoyable": ["fun", "enjoyable"],
  "well / energetic": ["well", "energetic", "healthy"],
  "still / not yet": ["still", "not yet"],
  "already / anymore": ["already", "anymore"],
  "again / also": ["again", "also"],
  "house / home": ["house", "home"],
  "shop / store": ["shop", "store"],
  "meal / rice": ["meal", "rice"],
  "noon / daytime": ["noon", "daytime"],
  "really / true": ["really", "true"],
  "probably / maybe": ["probably", "maybe"],
  might: ["might", "possibly"],
  "please / request": ["please", "request"],
  "excuse me / sorry": ["excuse me", "sorry"],
  "okay / all right": ["okay", "ok", "all right", "alright"],
  "more / furthermore": ["more", "furthermore", "moreover", "moreso", "more so", "sarani"],
};

function stripEnglishFluff(s: string): string {
  return (s || "")
    .replace(/^(a|an|the)\s+/gi, "")
    .replace(/\s+(a|an|the)$/gi, "")
    .replace(/^to\s+/i, "")
    .trim();
}

function normalizeEnglishAnswer(s: string): string {
  return normalizeEnglish(stripEnglishFluff(s));
}

/** Resolve ENGLISH_EXTRAS even when expected is only the first gloss (e.g. "shop" vs "shop / store"). */
export function extrasForEnglishGloss(expected: string): string[] {
  const norm = normalizeEnglish(expected);
  const out: string[] = [];
  for (const [key, vals] of Object.entries(ENGLISH_EXTRAS)) {
    const keyParts = key
      .split("/")
      .map((part) => normalizeEnglish(part.replace(/\([^)]*\)/g, "")));
    if (keyParts.includes(norm) || normalizeEnglish(key) === norm) {
      key.split("/").forEach((part) => out.push(part.trim()));
      out.push(...vals);
    }
  }
  (ENGLISH_EXTRAS[expected] || []).forEach((x) => out.push(x));
  return out;
}

export function buildEnglishTextAliases(expected: string, word?: JapaneseWord): string[] {
  const raw = expected.toLowerCase().replace(/\([^)]*\)/g, "").trim();
  const aliases = new Set<string>();
  if (raw) aliases.add(normalizeEnglishAnswer(raw));
  raw.split(/[/,;]/).forEach((part) => {
    const n = normalizeEnglishAnswer(part);
    if (n) aliases.add(n);
  });
  extrasForEnglishGloss(expected).forEach((x) => {
    const n = normalizeEnglishAnswer(x);
    if (n) aliases.add(n);
  });
  if (word) {
    englishAliases(word).forEach((x) => aliases.add(x));
  }
  return [...aliases].filter(Boolean);
}

export function englishAliases(word: JapaneseWord): string[] {
  const raw = word.en.toLowerCase().replace(/\([^)]*\)/g, "").trim();
  const arr: string[] = [raw];
  raw.split("/").forEach((x) => arr.push(x.trim()));
  (ENGLISH_EXTRAS[word.en] || []).forEach((x) => arr.push(x));
  extrasForEnglishGloss(word.en).forEach((x) => arr.push(x));
  return [...new Set(arr.map(normalizeEnglishAnswer).filter(Boolean))];
}

const ROMAJI_EXTRAS: Record<string, string[]> = {
  shitteru: ["shitteiru", "shitte iru", "shiru"],
};

export function normalizeRomaji(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/ā/g, "aa")
    .replace(/ī/g, "ii")
    .replace(/ū/g, "uu")
    .replace(/ē/g, "ee")
    .replace(/ō/g, "ou")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

export function romajiAliases(word: JapaneseWord): string[] {
  const base = normalizeRomaji(word.r);
  const forms = new Set([base]);
  forms.add(base.replace(/ou/g, "o"));
  forms.add(base.replace(/oo/g, "o"));
  forms.add(base.replace(/uu/g, "u"));
  forms.add(base.replace(/ee/g, "e"));
  forms.add(base.replace(/ii/g, "i"));
  (ROMAJI_EXTRAS[word.r] || []).forEach((x) => forms.add(normalizeRomaji(x)));
  return [...forms].filter(Boolean);
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return dp[n];
}

export function fuzzyMatchEnglish(input: string, word: JapaneseWord): boolean {
  const trimmed = input.trim();
  if (trimmed === word.jp || trimmed === word.audio) return true;
  return fuzzyMatch(input, englishAliases(word), "english");
}

export function fuzzyMatchRomaji(input: string, word: JapaneseWord): boolean {
  return fuzzyMatch(input, romajiAliases(word), "romaji");
}

function editDistanceAllowance(len: number): number {
  if (len >= 9) return 2;
  if (len >= 3) return 1;
  return 0;
}

function fuzzyMatch(
  input: string,
  aliases: string[],
  type: "english" | "romaji",
): boolean {
  const val = type === "romaji" ? normalizeRomaji(input) : normalizeEnglishAnswer(input);
  if (!val) return false;
  for (const a of aliases) {
    if (val === a) return true;
    if (type === "english") {
      const valTokens = val.split(" ").filter(Boolean);
      const aliasTokens = a.split(" ").filter(Boolean);
      if (valTokens.length > 1 && valTokens.includes(a)) return true;
      if (aliasTokens.length === 1 && valTokens.includes(a)) return true;
    }
    const compactVal = val.replace(/\s/g, "");
    const compactA = a.replace(/\s/g, "");
    const len = Math.max(compactVal.length, compactA.length);
    const allowance = editDistanceAllowance(len);
    if (allowance && editDistance(compactVal, compactA) <= allowance) return true;
  }
  return false;
}

export function fuzzyMatchEnglishText(
  input: string,
  expected: string,
  word?: JapaneseWord,
): boolean {
  const aliases = buildEnglishTextAliases(expected, word);
  return fuzzyMatch(input, aliases, "english");
}

/** Romaji token from milestone comprehension prompts: What does "mise" mean? */
export function parseComprehensionRomaji(prompt: string): string | null {
  const match = prompt.match(/what does\s+["']([^"']+)["']\s+mean/i);
  return match?.[1]?.trim().toLowerCase() ?? null;
}

export function formatAcceptedEnglishAnswers(expected: string, word?: JapaneseWord): string {
  const aliases = buildEnglishTextAliases(expected, word);
  const display = new Set<string>();
  display.add(expected.trim());
  if (word) {
    word.en
      .replace(/\([^)]*\)/g, "")
      .split("/")
      .forEach((part) => display.add(part.trim()));
  }
  extrasForEnglishGloss(expected).forEach((x) => display.add(x.trim()));
  for (const alias of aliases) {
    if (alias.split(" ").length <= 3) display.add(alias);
  }
  return [...display].filter(Boolean).slice(0, 8).join(", ");
}
