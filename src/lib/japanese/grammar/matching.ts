import { normalizeEnglish, normalizeRomaji } from "../matching";

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

function fuzzyEquals(input: string, aliases: string[]): boolean {
  const val = normalizeEnglish(input);
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

function fuzzyRomajiEquals(input: string, aliases: string[]): boolean {
  const val = normalizeRomaji(input);
  if (!val) return false;
  for (const a of aliases) {
    const norm = normalizeRomaji(a);
    if (val === norm) return true;
    const len = Math.max(val.length, norm.length);
    const allowance = len >= 9 ? 2 : len >= 5 ? 1 : 0;
    if (allowance && editDistance(val, norm) <= allowance) return true;
  }
  return false;
}

export function matchGrammarEnglish(input: string, answers: string[]): boolean {
  const aliases = answers.flatMap((a) => {
    const base = normalizeEnglish(a);
    return [base, ...base.split("/").map((x) => normalizeEnglish(x))];
  });
  return fuzzyEquals(input, [...new Set(aliases.filter(Boolean))]);
}

export function matchGrammarRomaji(input: string, answers: string[]): boolean {
  return fuzzyRomajiEquals(input, answers);
}

export function normalizeGrammarReorder(input: string): string {
  return input
    .toLowerCase()
    .replace(/[、,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchGrammarReorder(input: string, answer: string): boolean {
  return normalizeGrammarReorder(input) === normalizeGrammarReorder(answer);
}
