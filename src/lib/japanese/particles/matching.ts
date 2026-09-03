import {
  matchGrammarEnglish,
  matchGrammarRomaji,
  normalizeGrammarReorder,
} from "../grammar/matching";
import { normalizeRomaji } from "../matching";
import type { ParticleQuestion } from "./types";

export { matchGrammarEnglish, matchGrammarRomaji, normalizeGrammarReorder, normalizeRomaji };

export function normalizeParticleText(s: string): string {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/ā/g, "a")
    .replace(/ī/g, "i")
    .replace(/ū/g, "u")
    .replace(/ē/g, "e")
    .replace(/ō/g, "o")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

export function englishAlts(s: string): string[] {
  const out = new Set<string>([s]);
  if (s.includes(" / ")) {
    s.split(" / ").forEach((part) => out.add(part.trim()));
  }
  out.add(s.replace("don't", "do not"));
  out.add(s.replace("didn't", "did not"));
  out.add(s.replace("let's", "lets"));
  return [...out].filter(Boolean);
}

export function acceptedEnglish(question: ParticleQuestion, answer: string): boolean {
  const val = normalizeParticleText(answer);
  const alts = question.alts ?? englishAlts(question.en);
  return alts.some((alt) => normalizeParticleText(alt) === val);
}

export function matchParticleRomaji(input: string, expected: string): boolean {
  return normalizeParticleText(input) === normalizeParticleText(expected);
}

export function matchParticleSentence(inputTokens: string[], expectedRomaji: string): boolean {
  return normalizeParticleText(inputTokens.join(" ")) === normalizeParticleText(expectedRomaji);
}