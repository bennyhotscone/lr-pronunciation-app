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

function tokensEqual(a: string, b: string): boolean {
  const aAliases = expandRomajiAliases(a);
  return expandRomajiAliases(b).some((x) => aAliases.includes(x));
}

/** Exact ordered sequence match (after alias normalize). */
export function matchTokenSequence(
  provided: string[],
  expected: readonly string[],
): boolean {
  if (provided.length !== expected.length) return false;
  return expected.every((tok, i) => tokensEqual(provided[i], tok));
}

/**
 * Multiset includes: every required vocab word appears (any order).
 * Extra tokens allowed (particles / fillers).
 */
export function multisetIncludes(
  required: string[],
  provided: string[],
): boolean {
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
export function matchRevisionSentence(
  input: string,
  requiredWords: readonly string[],
): boolean {
  const tokens = tokenizeRomajiInput(input);
  if (!tokens.length || !requiredWords.length) return false;
  return multisetIncludes([...requiredWords], tokens);
}

export type SentenceAcceptResult = {
  ok: boolean;
  /** Matched the preferred (natural) sequence exactly. */
  preferred: boolean;
  /** Matched a caveman / particle-less accepted sequence. */
  caveman: boolean;
};

/**
 * Accept preferred natural Japanese OR any alternate acceptedAnswers sequence,
 * OR a multiset of the content words from preferred (caveman: particles optional).
 */
export function matchAcceptedSentenceAnswers(
  input: string | readonly string[],
  preferredAnswer: readonly string[],
  acceptedAnswers?: readonly (readonly string[])[],
): SentenceAcceptResult {
  const tokens = Array.isArray(input)
    ? input.map((t) => normalizeRomaji(String(t).toLowerCase())).filter(Boolean)
    : tokenizeRomajiInput(String(input));

  if (!tokens.length || !preferredAnswer.length) {
    return { ok: false, preferred: false, caveman: false };
  }

  const sequences: readonly (readonly string[])[] = [
    preferredAnswer,
    ...(acceptedAnswers ?? []),
  ];

  for (const seq of sequences) {
    if (matchTokenSequence(tokens, seq)) {
      const preferred = matchTokenSequence(
        [...seq].map((s) => normalizeRomaji(s)),
        preferredAnswer.map((s) => normalizeRomaji(s)),
      );
      return { ok: true, preferred, caveman: !preferred };
    }
  }

  // Caveman fallback: content words from preferred (skip common particles)
  const PARTICLES = new Set([
    "o",
    "wo",
    "ni",
    "de",
    "no",
    "to",
    "wa",
    "ga",
    "mo",
    "kara",
    "made",
    "e",
    "he",
    "ka",
    "ya",
    "ne",
    "yo",
  ]);
  const content = preferredAnswer.filter(
    (t) => !PARTICLES.has(normalizeRomaji(t)),
  );
  if (content.length && multisetIncludes(content, tokens)) {
    // Reject if they used none of the content words properly
    return { ok: true, preferred: false, caveman: true };
  }

  return { ok: false, preferred: false, caveman: false };
}

export function formatPreferredRomaji(preferredAnswer: readonly string[]): string {
  return preferredAnswer.join(" ");
}
