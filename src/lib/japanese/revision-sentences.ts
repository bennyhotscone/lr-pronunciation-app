import { getJapaneseBlock, isPlayableJapaneseBlock } from "./blocks";
import { getBlocksForRevisionGate } from "./revision-gate";
import rawSentences from "./revision-sentences.json";

export type RevisionSentenceTemplate = {
  id: string;
  english: string;
  preferredAnswer: string[];
  acceptedAnswers: string[][];
  tiles: string[];
  audioText?: string;
  explanation?: string;
  /** Legacy fields kept for older callers/tests. */
  romaji: string;
  words: string[];
};

type RawSentence = {
  id: string;
  english: string;
  preferredAnswer?: string[];
  acceptedAnswers?: string[][];
  tiles?: string[];
  audioText?: string;
  explanation?: string;
  romaji?: string;
  words?: string[];
};

type SentenceBank = Record<string, RawSentence[]>;

const SENTENCE_BANK = rawSentences as SentenceBank;

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
  "da",
  "desu",
]);

/** Cumulative vocab for sentences: all playable blocks up to this gate's end. */
function romajiSetForGateSentences(gateNumber: number): Set<string> {
  const set = new Set<string>(PARTICLES);
  const blocks = getBlocksForRevisionGate(gateNumber);
  const end = blocks[blocks.length - 1] ?? gateNumber * 5;
  for (let blockNumber = 1; blockNumber <= end; blockNumber++) {
    if (!isPlayableJapaneseBlock(blockNumber)) continue;
    for (const word of getJapaneseBlock(blockNumber)) {
      set.add(word.r.toLowerCase());
    }
  }
  return set;
}

function normalizeTemplate(raw: RawSentence): RevisionSentenceTemplate {
  const preferred =
    raw.preferredAnswer ??
    (raw.romaji ? raw.romaji.split(/\s+/).filter(Boolean) : raw.words ?? []);
  const accepted = raw.acceptedAnswers ?? [preferred];
  const words =
    raw.words ??
    preferred.filter((t) => !PARTICLES.has(t.toLowerCase()));
  const tiles =
    raw.tiles ??
    Array.from(new Set([...preferred, ...accepted.flat(), ...words]));
  return {
    id: raw.id,
    english: raw.english,
    preferredAnswer: preferred,
    acceptedAnswers: accepted,
    tiles,
    audioText: raw.audioText,
    explanation: raw.explanation,
    romaji: raw.romaji ?? preferred.join(" "),
    words,
  };
}

export function getRevisionSentencesForGate(gateNumber: number): RevisionSentenceTemplate[] {
  const templates = (SENTENCE_BANK[String(gateNumber)] ?? []).map(normalizeTemplate);
  const allowed = romajiSetForGateSentences(gateNumber);
  return templates.filter((sentence) => {
    const content = sentence.preferredAnswer.filter(
      (w) => !PARTICLES.has(w.toLowerCase()),
    );
    // Prefer keeping sentences whose content words are in cumulative vocab;
    // if none match yet (new blocks), still keep if at least one content word exists.
    return content.every((word) => allowed.has(word.toLowerCase()));
  });
}
