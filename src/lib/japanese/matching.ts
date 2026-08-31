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
  "house / home": ["house", "home"],
  "shop / store": ["shop", "store"],
  "meal / rice": ["meal", "rice"],
  "noon / daytime": ["noon", "daytime"],
  "really / true": ["really", "true"],
  "probably / maybe": ["probably", "maybe"],
  "please / request": ["please", "request"],
  "excuse me / sorry": ["excuse me", "sorry"],
  "okay / all right": ["okay", "ok", "all right", "alright"],
};

export function englishAliases(word: JapaneseWord): string[] {
  const raw = word.en.toLowerCase().replace(/\([^)]*\)/g, "").trim();
  const arr: string[] = [raw];
  raw.split("/").forEach((x) => arr.push(x.trim()));
  (ENGLISH_EXTRAS[word.en] || []).forEach((x) => arr.push(x));
  return [...new Set(arr.map(normalizeEnglish).filter(Boolean))];
}

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
  return fuzzyMatch(input, englishAliases(word), "english");
}

export function fuzzyMatchRomaji(input: string, word: JapaneseWord): boolean {
  return fuzzyMatch(input, romajiAliases(word), "romaji");
}

function fuzzyMatch(
  input: string,
  aliases: string[],
  type: "english" | "romaji",
): boolean {
  const val = type === "romaji" ? normalizeRomaji(input) : normalizeEnglish(input);
  if (!val) return false;
  for (const a of aliases) {
    if (val === a) return true;
    const compactVal = val.replace(/\s/g, "");
    const compactA = a.replace(/\s/g, "");
    const len = Math.max(compactVal.length, compactA.length);
    const allowance = len >= 9 ? 2 : len >= 5 ? 1 : 0;
    if (allowance && editDistance(compactVal, compactA) <= allowance) return true;
  }
  return false;
}
