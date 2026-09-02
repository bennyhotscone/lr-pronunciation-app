import {
  JAPANESE_BATCH_SIZE,
  JAPANESE_MASTERY_THRESHOLD,
  JAPANESE_CHOICE_COUNT,
  JAPANESE_MINI_REVIEW_SIZE,
  JAPANESE_TOTAL_BLOCKS,
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
import {
  getAudioText,
  getMnemonic,
  getPronunciationCue,
} from "./word-helpers";
import {
  buildPracticeOrder,
  computeFormalRoundScorePct,
  getKnownIndices,
} from "./known-words";

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
    roundIsRetry: false,
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
    displayMnemonic: getMnemonic(word, override),
    displayRomaji: getPronunciationCue(word, override),
    speakText: getAudioText(word, override),
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


function isRound1RetryQueue(state: JapaneseSessionState): boolean {
  return state.phase === "round1" && state.roundIsRetry && state.order.length > 0;
}

function round1TargetCount(state: JapaneseSessionState, wordCount: number): number {
  return isRound1RetryQueue(state) ? state.order.length : wordCount;
}

function round1WordIndex(state: JapaneseSessionState): number {
  return isRound1RetryQueue(state) ? state.order[state.introIndex] : state.introIndex;
}

function round1LearnedPool(state: JapaneseSessionState): number[] {
  if (isRound1RetryQueue(state)) {
    return state.order.slice(0, state.introIndex);
  }
  return Array.from({ length: state.introIndex }, (_, i) => i);
}

function shufflePracticeOrder(indices: number[]): number[] {
  return shuffle(indices);
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

export const ROUND_SHORT_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Learn",
  2: "Recognise",
  3: "Listen",
  4: "Understand",
  5: "Produce",
};

const ROUND_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Round 1 of 5 — Learn",
  2: "Round 2 of 5 — Recognise",
  3: "Round 3 of 5 — Listen",
  4: "Round 4 of 5 — Understand",
  5: "Round 5 of 5 — Produce",
};

/** Build the current training view from persisted session state. */
export function buildRoundView(
  state: JapaneseSessionState,
  words: JapaneseWord[],
  overrides: Record<number, JapaneseWordOverrideFields> = {},
  knownWords: import("./known-words").KnownWordsMap = {},
): JapaneseRoundView | null {
  const knownIndices = getKnownIndices(knownWords);
  const wordCount = words.length;
  const allIndices = words.map((_, i) => i);
  const resolvedAt = (index: number) =>
    resolveWord(words[index], index, overrides[index]);

  if (state.phase === "round1") {
    if (state.inMini) {
      if (state.miniIndex >= state.miniQueue.length) {
        return null;
      }
      const wordIndex = state.miniQueue[state.miniIndex];
      const miniWord = resolvedAt(wordIndex);
      return {
        kind: "round1-mini",
        wordIndex,
        counter: `Review ${state.miniIndex + 1}/${state.miniQueue.length} · ${state.introIndex} learned`,
        roundLabel: ROUND_LABELS[1],
        instruction:
          "Quick review of words you've learned. Hear the audio and choose the English meaning.",
        mnemonicHtml: `<div class="jp-learn-romaji-lg">${miniWord.displayRomaji}</div>`,
        showMnemonic: true,
        choicePool: makeChoiceIndices(wordIndex, round1LearnedPool(state), allIndices),
        progressPct: progressForRound1(state.introIndex, wordCount),
      };
    }

    const round1Total = round1TargetCount(state, wordCount);
    if (state.introIndex >= round1Total && !state.inMini) {
      return buildRoundCompleteView(state, words, 1, knownIndices);
    }

    const wordIndex = round1WordIndex(state);
    const w = resolvedAt(wordIndex);
    return {
      kind: "round1-new",
      wordIndex,
      counter: `New word ${state.introIndex + 1} of ${round1TargetCount(state, wordCount)}`,
      roundLabel: ROUND_LABELS[1],
      instruction:
        "Learn the pronunciation cue, English meaning, and memory hook. Play the audio, then pick the English meaning.",
      mnemonicHtml: `<div class="jp-learn-romaji-xl">${w.displayRomaji} = ${w.en}</div><div>${w.displayMnemonic}</div>`,
      showMnemonic: true,
      choicePool: makeChoiceIndices(
        wordIndex,
        [...round1LearnedPool(state), wordIndex],
        allIndices,
      ),
      progressPct: progressForRound1(state.introIndex, wordCount),
    };
  }

  const round = roundNumber(state.phase);
  if (state.qIndex >= state.order.length) {
    return buildRoundCompleteView(state, words, round, knownIndices);
  }

  const wordIndex = state.order[state.qIndex];
  const w = words[wordIndex];

  if (round === 2) {
    const cue = getPronunciationCue(w, overrides[wordIndex]);
    return {
      kind: "formal",
      wordIndex,
      round: 2,
      counter: `Question ${state.qIndex + 1} of ${state.order.length}`,
      roundLabel: ROUND_LABELS[2],
      instruction: "Hear the word and use the pronunciation cue. Choose its English meaning.",
      showMnemonic: false,
      showPronunciationCue: true,
      pronunciationCue: cue,
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
      roundLabel: ROUND_LABELS[3],
      instruction: "Listen to the audio only and choose the English meaning.",
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
      roundLabel: ROUND_LABELS[4],
      instruction: "LISTEN AND TYPE THE MEANING",
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
    roundLabel: ROUND_LABELS[5],
    instruction: "TYPE THE JAPANESE WORD",
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
  knownIndices: number[] = [],
): JapaneseRoundView {
  const wordCount = words.length;
  const orderLen =
    round === 1 ? round1TargetCount(state, wordCount) : state.order.length;
  const scorePct =
    round === 1
      ? 100
      : computeFormalRoundScorePct(
          state.score,
          orderLen,
          wordCount,
          knownIndices,
          !!state.roundIsRetry,
        );
  const passed = scorePct >= JAPANESE_MASTERY_THRESHOLD;
  const missedIndices = [...new Set(state.missed)];
  const retryRound = round >= 2 ? (round as 2 | 3 | 4 | 5) : undefined;

  if (round < 5) {
    return {
      kind: "round-complete",
      round,
      scorePct,
      passed,
      missedIndices,
      progressPct: round * 20,
      nextRound: (round + 1) as 2 | 3 | 4 | 5,
      retryRound,
      knownCount: knownIndices.length,
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
    retryRound,
    knownCount: knownIndices.length,
  };
}

/** After answering correctly in round 1 (choice). */
export function advanceAfterRound1Correct(
  state: JapaneseSessionState,
  wordCount: number,
): JapaneseSessionState {
  if (state.inMini) {
    const next = { ...state, miniIndex: state.miniIndex + 1 };
    if (next.miniIndex >= next.miniQueue.length) {
      return { ...next, inMini: false, miniIndex: 0, miniQueue: [] };
    }
    return next;
  }

  const nextIntro = state.introIndex + 1;
  const target = round1TargetCount(state, wordCount);
  if (nextIntro > 0 && nextIntro % JAPANESE_BATCH_SIZE === 0 && nextIntro < target) {
    const pool = round1LearnedPool({ ...state, introIndex: nextIntro });
    const miniQueue = shuffle(pool).slice(0, Math.min(JAPANESE_MINI_REVIEW_SIZE, pool.length));
    return {
      ...state,
      introIndex: nextIntro,
      inMini: true,
      miniIndex: 0,
      miniQueue,
    };
  }

  if (nextIntro >= target) {
    return { ...state, introIndex: nextIntro };
  }

  return { ...state, introIndex: nextIntro };
}

/** Retry the current round without advancing phase. */
export function retryRound(
  state: JapaneseSessionState,
  wordCount: number,
  knownIndices: number[] = [],
): JapaneseSessionState {
  if (state.phase === "round1") {
    return startRound1Retry(wordCount, knownIndices);
  }
  const round = roundNumber(state.phase);
  if (round >= 2 && round <= 5) {
    return startFormalRound(state, round as 2 | 3 | 4 | 5, wordCount, {
      isRetry: true,
      knownIndices,
    });
  }
  return state;
}

/** Highest round the learner may jump to (1-5) for this block. */
export function getHighestRoundReached(
  state: JapaneseSessionState,
  meta: JapaneseBlockMeta,
  wordCount: number,
): 1 | 2 | 3 | 4 | 5 {
  let fromState: 1 | 2 | 3 | 4 | 5 = 1;
  if (state.phase === "round1") {
    if (!state.inMini && state.introIndex >= wordCount) fromState = 2;
  } else {
    const round = roundNumber(state.phase);
    fromState = round;
    if (state.order.length > 0 && state.qIndex >= state.order.length) {
      fromState = Math.min(5, round + 1) as 1 | 2 | 3 | 4 | 5;
    }
  }

  let fromMeta: 1 | 2 | 3 | 4 | 5 = 1;
  const scoreKeys = (["2", "3", "4", "5"] as const).filter(
    (k) => typeof meta.roundScores[k] === "number",
  );
  if (scoreKeys.length > 0) {
    const maxCompleted = Math.max(...scoreKeys.map((k) => Number(k))) as 2 | 3 | 4 | 5;
    fromMeta = Math.min(5, maxCompleted + 1) as 1 | 2 | 3 | 4 | 5;
  }

  if (meta.bestRound5Score > 0 || typeof meta.roundScores["5"] === "number") {
    fromMeta = Math.max(fromMeta, 5) as 1 | 2 | 3 | 4 | 5;
  }

  return Math.max(fromState, fromMeta) as 1 | 2 | 3 | 4 | 5;
}

/** Round currently represented by session state (including round-complete screens). */
export function getActiveRound(
  state: JapaneseSessionState,
  wordCount: number,
): 1 | 2 | 3 | 4 | 5 {
  if (state.phase === "round1") return 1;
  return roundNumber(state.phase);
}

/** Jump to a round at its start (or round 1 complete if learn phase was finished). */
export function jumpToRound(
  state: JapaneseSessionState,
  round: 1 | 2 | 3 | 4 | 5,
  wordCount: number,
  knownIndices: number[] = [],
): JapaneseSessionState {
  if (round === 1) {
    if (!state.inMini && state.introIndex >= wordCount) {
      return { ...createInitialSessionState(), introIndex: wordCount, phase: "round1" };
    }
    return createInitialSessionState();
  }
  const base: JapaneseSessionState = {
    ...state,
    introIndex: Math.max(state.introIndex, wordCount),
  };
  return startFormalRound(base, round, wordCount, { knownIndices });
}



/** Start formal round n (2-5). Finite shuffled queue — never refilled. */
export function startRound1Retry(
  wordCount: number,
  knownIndices: number[] = [],
): JapaneseSessionState {
  const pool = shufflePracticeOrder(buildPracticeOrder(wordCount, knownIndices, true));
  return {
    ...createInitialSessionState(),
    phase: "round1",
    order: pool,
    roundIsRetry: true,
  };
}

export function startFormalRound(
  state: JapaneseSessionState,
  n: 2 | 3 | 4 | 5,
  wordCount: number,
  options?: { isRetry?: boolean; knownIndices?: number[] } | ReadonlySet<number>,
): JapaneseSessionState {
  let isRetry = false;
  let knownIndices: number[] = [];
  if (options instanceof Set) {
    knownIndices = [...options];
  } else if (options) {
    const opts = options as { isRetry?: boolean; knownIndices?: number[] };
    isRetry = !!opts.isRetry;
    knownIndices = opts.knownIndices ?? [];
  }
  const pool = shufflePracticeOrder(buildPracticeOrder(wordCount, knownIndices, isRetry));
  return {
    ...state,
    phase: `round${n}` as JapanesePhase,
    qIndex: 0,
    score: 0,
    missed: [],
    order: pool,
    roundIsRetry: isRetry,
  };
}

/** After round 1 completes, transition to round 2. */
export function transitionRound1ToRound2(
  state: JapaneseSessionState,
  wordCount: number,
  knownIndices: number[] = [],
): JapaneseSessionState {
  return startFormalRound({ ...state, introIndex: wordCount }, 2, wordCount, {
    isRetry: false,
    knownIndices,
  });
}

/** Advance after answering in formal rounds 2-5. */
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
  blockNumber: number,
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
      const nextBlock = blockNumber + 1;
      if (nextBlock <= JAPANESE_TOTAL_BLOCKS && !unlockedBlocks.includes(nextBlock)) {
        unlockedBlocks.push(nextBlock);
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
  roundIsRetry?: boolean;
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
    roundIsRetry: !!row.roundIsRetry,
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

/** Recover session stuck at end of round 1 or with empty formal queue. */
export function repairSessionState(
  state: JapaneseSessionState,
  wordCount: number,
  knownIndices: number[] = [],
): JapaneseSessionState {
  if (state.phase === "round1" && !state.inMini && state.introIndex >= wordCount) {
    return state;
  }

  const round = roundNumber(state.phase);
  if (round >= 2 && state.order.length > 0 && state.qIndex >= state.order.length) {
    return state;
  }

  if (round >= 2 && state.order.length === 0) {
    return startFormalRound(state, round as 2 | 3 | 4 | 5, wordCount, { isRetry: !!state.roundIsRetry, knownIndices: [] });
  }

  if (round >= 2 && state.qIndex > state.order.length) {
    return { ...state, qIndex: state.order.length };
  }

  return state;
}
