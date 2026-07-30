/**
 * Forced-choice matcher for L/R minimal pairs.
 *
 * Whisper (especially Tiny) often returns near-miss spellings, punctuation,
 * or common English homophones ("write" for "right", "lite" for "light").
 * Strict equality therefore fails even when the student said the target.
 *
 * Strategy: normalise the transcript, expand both candidate words with known
 * spelling/homophone variants, score every token against both candidates with
 * exact / variant / edit-distance / phonetic keys, and pick the clearer side.
 * Return "unclear" only when the clip is empty or the two scores are tied.
 */

export function normalizeTranscript(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ");
}

/** Common ASR / spelling variants for words that appear in the pair list. */
const VARIANT_GROUPS: readonly (readonly string[])[] = [
  ["right", "write", "rite", "wright"],
  ["light", "lite", "lit"],
  ["rain", "reign", "rein"],
  ["lane", "lain"],
  ["red", "read", "redd"],
  ["led", "lead"],
  ["read", "reed", "red"],
  ["blew", "blue"],
  ["blue", "blew"],
  ["flew", "flu", "flue"],
  ["fly", "flight"],
  ["row", "roe"],
  ["ray", "rae", "re"],
  ["lay", "lei"],
  ["law", "lore"],
  ["raw", "roar"],
  ["rye", "wry", "rai"],
  ["lie", "lye"],
  ["low", "lo"],
  ["loot", "lute"],
  ["root", "route"],
  ["room", "rheum"],
  ["wrap", "rap"],
  ["rap", "wrap"],
  ["wrist", "rist"],
  ["wrong", "rong"],
  ["long", "lung"],
  ["lock", "loch"],
  ["rock", "roc"],
  ["lice", "lyse"],
  ["rice", "rise"],
  ["list", "liszt"],
  ["alive", "a live"],
  ["arrive", "a rive"],
];

const VARIANT_LOOKUP = (() => {
  const map = new Map<string, Set<string>>();
  for (const group of VARIANT_GROUPS) {
    const set = new Set(group.map((word) => normalizeTranscript(word)));
    for (const word of set) {
      const existing = map.get(word) ?? new Set<string>();
      for (const member of set) existing.add(member);
      map.set(word, existing);
    }
  }
  return map;
})();

function variantsFor(word: string): Set<string> {
  const normalised = normalizeTranscript(word);
  const variants = new Set<string>([normalised]);
  const known = VARIANT_LOOKUP.get(normalised);
  if (known) {
    for (const member of known) variants.add(member);
  }
  return variants;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let index = 0; index <= b.length; index += 1) previous[index] = index;

  for (let i = 0; i < a.length; i += 1) {
    current[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      current[j + 1] = Math.min(
        current[j] + 1,
        previous[j + 1] + 1,
        previous[j] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

/**
 * Lightweight phonetic key inspired by Double Metaphone, enough to equate
 * common L/R near-misses Whisper emits without pulling in a dependency.
 */
export function phoneticKey(raw: string): string {
  let word = normalizeTranscript(raw).replace(/[^a-z]/g, "");
  if (!word) return "";

  word = word
    .replace(/^(wr)/, "r")
    .replace(/^(kn|gn)/, "n")
    .replace(/^x/, "s")
    // Apply -ight before gh→g so "right"/"light" keep a shared stem with "write"/"lite".
    .replace(/ight$/g, "ite")
    .replace(/ite$/g, "it")
    .replace(/ph/g, "f")
    .replace(/gh/g, "g")
    .replace(/ck/g, "k")
    .replace(/qu/g, "kw")
    .replace(/x/g, "ks")
    .replace(/tion$/g, "shun")
    .replace(/sion$/g, "zhun")
    .replace(/ough$/g, "o")
    .replace(/ege$/g, "ej")
    .replace(/dge$/g, "j")
    .replace(/([aeiou])y$/g, "$1i");

  // Collapse consecutive identical consonants (keep vowels for short words).
  let collapsed = word[0] ?? "";
  for (let index = 1; index < word.length; index += 1) {
    if (word[index] !== word[index - 1]) collapsed += word[index];
  }

  // Map soft consonant clusters to a coarser alphabet.
  return collapsed
    .replace(/[aeiou]/g, "")
    .replace(/c/g, "k")
    .replace(/q/g, "k")
    .replace(/z/g, "s")
    .replace(/v/g, "f")
    .replace(/b/g, "p")
    .replace(/d/g, "t")
    .replace(/g(?!h)/g, "k")
    .replace(/j/g, "ch")
    .replace(/y/g, "i");
}

function bestTokenScore(token: string, candidate: string): number {
  const variants = variantsFor(candidate);
  const tokenKey = phoneticKey(token);

  let best = 0;
  for (const variant of variants) {
    if (token === variant) {
      best = Math.max(best, 1);
      continue;
    }
    if (token.includes(variant) || variant.includes(token)) {
      const overlap =
        Math.min(token.length, variant.length) /
        Math.max(token.length, variant.length);
      best = Math.max(best, 0.72 + overlap * 0.18);
      continue;
    }

    const distance = levenshtein(token, variant);
    const maxLen = Math.max(token.length, variant.length, 1);
    const similarity = 1 - distance / maxLen;
    if (similarity >= 0.55) {
      best = Math.max(best, similarity * 0.92);
    }

    const variantKey = phoneticKey(variant);
    if (tokenKey && variantKey && tokenKey === variantKey) {
      best = Math.max(best, 0.84);
    } else if (tokenKey && variantKey) {
      const keyDistance = levenshtein(tokenKey, variantKey);
      const keyMax = Math.max(tokenKey.length, variantKey.length, 1);
      const keySimilarity = 1 - keyDistance / keyMax;
      if (keySimilarity >= 0.7) {
        best = Math.max(best, keySimilarity * 0.78);
      }
    }
  }
  return best;
}

function scoreAgainstCandidate(
  tokens: string[],
  full: string,
  candidate: string,
): number {
  const variants = variantsFor(candidate);
  if (variants.has(full)) return 1;

  let best = 0;
  for (const token of tokens) {
    best = Math.max(best, bestTokenScore(token, candidate));
  }

  // Also score the whole phrase once (handles "a light", "the right one").
  if (tokens.length > 1) {
    best = Math.max(best, bestTokenScore(full, candidate) * 0.95);
  }
  return best;
}

export function matchPairWords(
  transcript: string,
  targetWord: string,
  otherWord: string,
): "target" | "other" | "unclear" {
  const normalised = normalizeTranscript(transcript);
  if (!normalised) return "unclear";

  const tokens = normalised.split(" ").filter(Boolean);
  if (tokens.length === 0) return "unclear";

  const targetScore = scoreAgainstCandidate(tokens, normalised, targetWord);
  const otherScore = scoreAgainstCandidate(tokens, normalised, otherWord);

  // Require a clear winner. Tiny Whisper often lands near both L/R words;
  // a tiny margin is not trustworthy for student feedback.
  const margin = Math.abs(targetScore - otherScore);
  const leader = Math.max(targetScore, otherScore);

  if (leader < 0.58) return "unclear";
  if (margin < 0.08) return "unclear";

  return targetScore > otherScore ? "target" : "other";
}
