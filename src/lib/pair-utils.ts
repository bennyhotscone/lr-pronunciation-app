import { pronunciationPairs, type PronunciationPair } from "@/data/pairs";

export const PAIR_COUNT = pronunciationPairs.length;

export function getPairBySequence(sequence: number): PronunciationPair | undefined {
  return pronunciationPairs.find((pair) => pair.sequence === sequence);
}

export function clampSequence(sequence: number): number {
  if (Number.isNaN(sequence) || sequence < 1) return 1;
  if (sequence > PAIR_COUNT) return PAIR_COUNT;
  return sequence;
}

export function getOtherWord(pair: PronunciationPair, targetWord: string): string {
  if (targetWord === pair.leftWord) return pair.rightWord;
  return pair.leftWord;
}

export function shuffleTwo<T>(a: T, b: T): [T, T] {
  return Math.random() < 0.5 ? [a, b] : [b, a];
}
