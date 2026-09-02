import { normalizeRomaji, romajiAliases } from "./matching";

/** Split learner romaji input into normalized word tokens. */
export function tokenizeRomajiInput(input: string): string[] {
  return (input || "")
    .toLowerCase()
    .split(/\s+/)
    .map((part) => normalizeRomaji(part))
    .filter(Boolean);
}

function expandRomajiAliases(token: string): string[] {
  return romajiAliases({ jp: "", audio: "", r: token, en: "", m: "" });
}

function multisetIncludes(required: string[], provided: string[]): boolean {
  const pool = [...provided];
  for (const word of required) {
    const aliases = expandRomajiAliases(word);
    const idx = pool.findIndex((token) => aliases.includes(token));
    if (idx === -1) return false;
    pool.splice(idx, 1);
  }
  return true;
}

/**
 * Pass when every required vocab word appears in the answer (any order).
 * Extra tokens are allowed (particle / grammar flexibility).
 */
export function matchRevisionSentence(input: string, requiredWords: readonly string[]): boolean {
  const tokens = tokenizeRomajiInput(input);
  if (!tokens.length || !requiredWords.length) return false;
  return multisetIncludes([...requiredWords], tokens);
}
