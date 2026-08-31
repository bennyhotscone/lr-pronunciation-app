import {
  JAPANESE_BATCH_SIZE,
  JAPANESE_MASTERY_THRESHOLD,
  JAPANESE_CHOICE_COUNT,
  JAPANESE_MINI_REVIEW_SIZE,
} from "./config";
import type {
  JapaneseBlockMeta,
  JapanesePhase,
  JapaneseRoundView,
  JapaneseSessionState,
  JapaneseWord,
  JapaneseWordOverrideFields,
  ResolvedJapaneseWord,
} from "./types";

export function shuffle<T>(items: T[]): T[] {
  const x = [...items];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

export function createInitialSessionState(): JapaneseSessionState {
  return {
    phase: "round1",
    introIndex: 0,
    miniQueue: [],
    miniIndex: 0,
    inMini: false,
    order: [],
    qIndex: 0,
    score: 0,
    missed: [],
  };
}

export function createInitialBlockMeta(): JapaneseBlockMeta {
  return {
    roundScores: {},
    bestRound5Score: 0,
    blockMastered: false,
    unlockedBlocks: [1],
  };
}

export function resolveWord(
  word: JapaneseWord,
  index: number,
  override?: JapaneseWordOverrideFields | null,
): ResolvedJapaneseWord {
  return {
    ...word,
    index,
    displayMnemonic: override?.mnemonic?.trim() || word.m,
    displayRomaji: override?.pronunciationCue?.trim() || word.r,
    speakText: override?.ttsInput?.trim() || word.audio,
  };
}

export function makeChoiceIndices(
  correctIndex: number,
  pool: number[],
  allIndices: number[],
): number[] {
  let opts = [correctIndex];
  const preferred = shuffle(pool.filter((w) => w !== correctIndex));
  for (const w of preferred) {
    if (opts.length >= JAPANESE_CHOICE_COUNT) break;
    if (!opts.includes(w)) opts.push(w);
  }
  const rest = shuffle(allIndices.filter((w) => w !== correctIndex && !opts.includes(w)));
  for (const w of rest) {
    if (opts.length >= JAPANESE_CHOICE_COUNT) break;
    opts.push(w);
  }
  return shuffle(opts);
}

function roundNumber(phase: JapanesePhase): 1 | 2 | 3 | 4 | 5 {
  return Number(phase.replace("round", "")) as 1 | 2 | 3 | 4 | 5;
}

function progressForRound1(introIndex: number, wordCount: number): number {
  return (introIndex / wordCount) * 20;
}

function progressForFormal(round: number, qIndex: number, wordCount: number): number {
  return (round - 1) * 20 + (qIndex / wordCount) * 20;
}

/** Build the current training view from persisted session state. */
export function buildRoundView(
  state: JapaneseSessionState,
  words: JapaneseWord[],
): JapaneseRoundView | null {
  const wordCount = words.length;
  const allIndices = words.map((_, i) => i);

  if (state.phase === "round1") {
    if (state.inMini) {
      if (state.miniIndex >= state.miniQueue.length) {
        return null;
      }
      const wordIndex = state.miniQueue[state.miniIndex];
      return {
        kind: "round1-mini",
        wordIndex,
        counter: `Quick mixed review ${state.miniIndex + 1}/${state.miniQueue.length} · ${state.introIndex} learned`,
        roundLabel: "ROUND 1 · TEACH WITH MNEMONICS",
        instruction:
          "Quick assisted review: romaji stays visible. Hear it and choose the English meaning.",
        mnemonicHtml: `<div class="jp-learn-romaji-lg">${words[wordIndex].r}</div>`,
        showMnemonic: true,
        choicePool: makeChoiceIndices(wordIndex, allIndices.slice(0, state.introIndex), allIndices),
        progressPct: progressForRound1(state.introIndex, wordCount),
      };
    }

    if (state.introIndex >= wordCount && !state.inMini) {
      return null;
    }

    const wordIndex = state.introIndex;
    const w = words[wordIndex];
    return {
      kind: "round1-new",
      wordIndex,
      counter: `New word ${state.introIndex + 1} of ${wordCount}`,
      roundLabel: "ROUND 1 · TEACH WITH MNEMONICS",
      instruction:
        "This is teaching, not guessing. Learn the meaning, hear the Japanese, then pick the meaning you were just shown.",
      mnemonicHtml: `<div class="jp-learn-romaji-xl">${w.r} = ${w.en}</div><div>${w.m}</div>`,
      showMnemonic: true,
      choicePool: makeChoiceIndices(
        wordIndex,
        allIndices.slice(0, state.introIndex + 1),
        allIndices,
      ),
      progressPct: progressForRound1(state.introIndex, wordCount),
    };
  }

  const round = roundNumber(state.phase);
  if (state.qIndex >= state.order.length) {
    return buildRoundCompleteView(state, words, round);
  }

  const wordIndex = state.order[state.qIndex];
  const w = words[wordIndex];

  if (round === 2) {
    return {
      kind: "formal",
      wordIndex,
      round: 2,
      counter: `Question ${state.qIndex + 1} of ${state.order.length}`,
      roundLabel: "ROUND 2 · ROMAJI + AUDIO",
      instruction: "Hear the word and use the romaji cue. Choose its English meaning.",
      showMnemonic: true,
      mnemonicHtml: `<div class="jp-learn-romaji-xl">${w.r}</div>`,
      choicePool: makeChoiceIndices(wordIndex, allIndices, allIndices),
      progressPct: progressForFormal(2, state.qIndex, wordCount),
      scoreLabel: `${state.score} correct`,
      mode: "choices",
    };
  }

  if (round === 3) {
    return {
      kind: "formal",
      wordIndex,
      round: 3,
      counter: `Question ${state.qIndex + 1} of ${state.order.length}`,
      roundLabel: "ROUND 3 · AUDIO ONLY",
      instruction:
        "No romaji and no mnemonic. Hear the Japanese and choose the English meaning.",
      showMnemonic: false,
      choicePool: makeChoiceIndices(wordIndex, allIndices, allIndices),
      progressPct: progressForFormal(3, state.qIndex, wordCount),
      scoreLabel: `${state.score} correct`,
      mode: "choices",
    };
  }

  if (round === 4) {
    return {
      kind: "formal",
      wordIndex,
      round: 4,
      counter: `Question ${state.qIndex + 1} of ${state.order.length}`,
      roundLabel: "ROUND 4 · TYPE THE ENGLISH",
      instruction:
        "Hear the Japanese and type its English meaning. Case and punctuation do not matter; close spelling and common equivalent meanings are accepted.",
      showMnemonic: false,
      choicePool: [],
      progressPct: progressForFormal(4, state.qIndex, wordCount),
      scoreLabel: `${state.score} correct`,
      mode: "type-english",
    };
  }

  return {
    kind: "formal",
    wordIndex,
    round: 5,
    counter: `Question ${state.qIndex + 1} of ${state.order.length}`,
    roundLabel: "ROUND 5 · PRODUCE THE JAPANESE",
    instruction:
      "Type the Japanese word in romaji. Long-vowel shortcuts and small spelling slips are tolerated.",
    showMnemonic: false,
    choicePool: [],
    progressPct: progressForFormal(5, state.qIndex, wordCount),
    scoreLabel: `${state.score} correct`,
    mode: "type-romaji",
    promptEnglish: w.en,
  };
}

function buildRoundCompleteView(
  state: JapaneseSessionState,
  words: JapaneseWord[],
  round: 1 | 2 | 3 | 4 | 5,
): JapaneseRoundView {
  const orderLen = round === 1 ? words.length : state.order.length;
  const scorePct =
    round === 1 ? 100 : Math.round((state.score / Math.max(orderLen, 1)) * 100);
  const passed = scorePct >= JAPANESE_MASTERY_THRESHOLD;
  const missedIndices = [...new Set(state.missed)];

  if (round < 5) {
    return {
      kind: "round-complete",
      round,
      scorePct,
      passed,
      missedIndices,
      progressPct: round * 20,
      nextRound: (round + 1) as 2 | 3 | 4 | 5,
    };
  }

  return {
    kind: "round-complete",
    round: 5,
    scorePct,
    passed,
    missedIndices,
    progressPct: 100,
    blockMastered: passed,
  };
}

/** After answering correctly in round 1 (choice). */
export function advanceAfterRound1Correct(state: JapaneseSessionState, wordCount: number): JapaneseSessionState {
  if (state.inMini) {
    const next = { ...state, miniIndex: state.miniIndex + 1 };
    if (next.miniIndex >= next.miniQueue.length) {
      return { ...next, inMini: false, miniIndex: 0, miniQueue: [] };
    }
    return next;
  }

  const nextIntro = state.introIndex + 1;
  if (nextIntro > 0 && nextIntro % JAPANESE_BATCH_SIZE === 0 && nextIntro < wordCount) {
    const pool = Array.from({ length: nextIntro }, (_, i) => i);
    const miniQueue = shuffle(pool).slice(0, Math.min(JAPANESE_MINI_REVIEW_SIZE, pool.length));
    return {
      ...state,
      introIndex: nextIntro,
      inMini: true,
      miniIndex: 0,
      miniQueue,
    };
  }

  if (nextIntro >= wordCount) {
    return { ...state, introIndex: nextIntro };
  }

  return { ...state, introIndex: nextIntro };
}

/** Start formal round n (2–5). */
export function startFormalRound(state: JapaneseSessionState, n: 2 | 3 | 4 | 5, wordCount: number): JapaneseSessionState {
  return {
    ...state,
    phase: `round${n}` as JapanesePhase,
    qIndex: 0,
    score: 0,
    missed: [],
    order: shuffle(Array.from({ length: wordCount }, (_, i) => i)),
  };
}

/** After round 1 completes, transition to round 2. */
export function transitionRound1ToRound2(state: JapaneseSessionState, wordCount: number): JapaneseSessionState {
  return startFormalRound({ ...state, introIndex: wordCount }, 2, wordCount);
}

/** Advance after answering in formal rounds 2–5. */
export function advanceFormalQuestion(state: JapaneseSessionState): JapaneseSessionState {
  return { ...state, qIndex: state.qIndex + 1 };
}

/** Record a correct answer. */
export function recordCorrect(state: JapaneseSessionState): JapaneseSessionState {
  return { ...state, score: state.score + 1 };
}

/** Record a missed word. */
export function recordMiss(state: JapaneseSessionState, wordIndex: number): JapaneseSessionState {
  return { ...state, missed: [...state.missed, wordIndex] };
}

/** Update block meta after completing a formal round. */
export function updateMetaAfterRound(
  meta: JapaneseBlockMeta,
  round: 2 | 3 | 4 | 5,
  scorePct: number,
): JapaneseBlockMeta {
  const roundScores = { ...meta.roundScores, [String(round)]: scorePct };
  let bestRound5Score = meta.bestRound5Score;
  let blockMastered = meta.blockMastered;
  const unlockedBlocks = [...meta.unlockedBlocks];

  if (round === 5) {
    bestRound5Score = Math.max(bestRound5Score, scorePct);
    if (scorePct >= JAPANESE_MASTERY_THRESHOLD) {
      blockMastered = true;
      if (!unlockedBlocks.includes(2)) {
        unlockedBlocks.push(2);
      }
    }
  }

  return { roundScores, bestRound5Score, blockMastered, unlockedBlocks };
}

export function parseIndexArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is number => typeof x === "number" && Number.isInteger(x));
}

export function parseRoundScores(value: unknown): JapaneseBlockMeta["roundScores"] {
  if (!value || typeof value !== "object") return {};
  const out: JapaneseBlockMeta["roundScores"] = {};
  for (const key of ["2", "3", "4", "5"] as const) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === "number") out[key] = v;
  }
  return out;
}

export function sessionFromDb(row: {
  phase: string;
  introIndex: number;
  inMini: boolean;
  miniIndex: number;
  miniQueue: unknown;
  qIndex: number;
  score: number;
  order: unknown;
  missed: unknown;
}): JapaneseSessionState {
  return {
    phase: row.phase as JapanesePhase,
    introIndex: row.introIndex,
    inMini: row.inMini,
    miniIndex: row.miniIndex,
    miniQueue: parseIndexArray(row.miniQueue),
    qIndex: row.qIndex,
    score: row.score,
    order: parseIndexArray(row.order),
    missed: parseIndexArray(row.missed),
  };
}

export function metaFromDb(row: {
  roundScores: unknown;
  bestRound5Score: number;
  blockMastered: boolean;
  unlockedBlocks: number[];
}): JapaneseBlockMeta {
  return {
    roundScores: parseRoundScores(row.roundScores),
    bestRound5Score: row.bestRound5Score,
    blockMastered: row.blockMastered,
    unlockedBlocks: row.unlockedBlocks.length ? row.unlockedBlocks : [1],
  };
}
