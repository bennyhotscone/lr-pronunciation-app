import { getJapaneseBlock, isPlayableJapaneseBlock } from "./blocks";
import { getBlocksForRevisionGate } from "./revision-gate";
import rawSentences from "./revision-sentences.json";

export type RevisionSentenceTemplate = {
  id: string;
  english: string;
  romaji: string;
  words: string[];
};

type SentenceBank = Record<string, RevisionSentenceTemplate[]>;

const SENTENCE_BANK = rawSentences as SentenceBank;

function romajiSetForGate(gateNumber: number): Set<string> {
  const set = new Set<string>();
  for (const blockNumber of getBlocksForRevisionGate(gateNumber)) {
    if (!isPlayableJapaneseBlock(blockNumber)) continue;
    for (const word of getJapaneseBlock(blockNumber)) {
      set.add(word.r.toLowerCase());
    }
  }
  return set;
}

export function getRevisionSentencesForGate(gateNumber: number): RevisionSentenceTemplate[] {
  const templates = SENTENCE_BANK[String(gateNumber)] ?? [];
  const allowed = romajiSetForGate(gateNumber);
  return templates.filter((sentence) =>
    sentence.words.every((word) => allowed.has(word.toLowerCase())),
  );
}
