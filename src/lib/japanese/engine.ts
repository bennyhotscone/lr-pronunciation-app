import {
  JAPANESE_ALWAYS_UNLOCKED_BLOCKS,
  JAPANESE_BATCH_SIZE,
  JAPANESE_KNOWN_THRESHOLD,
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
import { isBlockBehindRevisionGate } from "./revision-gate";
import {
  computeFormalRoundScorePct,
  getKnownIndices,
  skipKnownIntroIndex,
} from "./known-words";
import {
  buildLearnQueue,
  buildReviewQueue,
  emptyPriorLearning,
  isCurrentBlockOrderId,
  resolveQueueItem,
  reviewBadgeLabel,
  type PriorLearning,
} from "./round-queue";
import { getJapaneseBlock } from "./blocks";

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
    roundStreaks: {},
    sessionRetired: [],
  };
}

export function createInitialBlockMeta(): JapaneseBlockMeta {
  return {
    roundScores: {},
    bestRound5Score: 0,
    blockMastered: false,
    unlockedBlocks: Array.from(
      { length: JAPANESE_ALWAYS_UNLOCKED_BLOCKS },
      (_, i) => i + 1,
    ),
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

export type RoundViewContext = {
  blockNumber?: number;
  priorLearning?: PriorLearning;
};

/** Build the current training view from persisted session state. */
export function buildRoundView(
  state: JapaneseSessionState,
  words: JapaneseWord[],
  overrides: Record<number, JapaneseWordOverrideFields> = {},
  knownWords: import("./known-words").KnownWordsMap = {},
  ctx: RoundViewContext = {},
): JapaneseRoundView | null {
  const knownIndices = getKnownIndices(knownWords);
  const wordCount = words.length;
  const allIndices = words.map((_, i) => i);
  const blockNumber = ctx.blockNumber ?? 1;
  const priorLearning = ctx.priorLearning ?? emptyPriorLearning();
  const resolvedAt = (index: number) =>
    resolveWord(words[index], index, overrides[index]);

  const promptForOrderId = (orderId: number) => {
    const item = resolveQueueItem(orderId, blockNumber, wordCount, priorLearning);
    if (item.isExternalReview) {
      const sourceWords = getJapaneseBlock(item.sourceBlock);
      const word = sourceWords[item.sourceWordIndex];
      return {
        item,
        word,
        resolved: resolveWord(word, item.sourceWordIndex, null),
        reviewLabel: item.reviewFromBlock
          ? reviewBadgeLabel(item.reviewFromBlock)
          : undefined,
      };
    }
    const word = words[item.sourceWordIndex];
    return {
      item,
      word,
      resolved: resolveWord(word, item.sourceWordIndex, overrides[item.sourceWordIndex]),
      reviewLabel:
        (state.phase === "round4" || state.phase === "round5") && item.reviewFromBlock
          ? reviewBadgeLabel(item.reviewFromBlock)
          : undefined,
    };
  };

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
        sourceBlock: blockNumber,
        sourceWordIndex: wordIndex,
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
      sourceBlock: blockNumber,
      sourceWordIndex: wordIndex,
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
  const prompt = promptForOrderId(wordIndex);
  const w = prompt.word;

  if (round === 2) {
    const cue = prompt.item.isExternalReview
      ? getPronunciationCue(w, null)
      : getPronunciationCue(w, overrides[prompt.item.sourceWordIndex]);
    return {
      kind: "formal",
      wordIndex,
      sourceBlock: prompt.item.sourceBlock,
      sourceWordIndex: prompt.item.sourceWordIndex,
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
      reviewLabel: prompt.reviewLabel,
    };
  }

  if (round === 3) {
    return {
      kind: "formal",
      wordIndex,
      sourceBlock: prompt.item.sourceBlock,
      sourceWordIndex: prompt.item.sourceWordIndex,
      round: 3,
      counter: `Question ${state.qIndex + 1} of ${state.order.length}`,
      roundLabel: ROUND_LABELS[3],
      instruction: "Listen to the audio only and choose the English meaning.",
      showMnemonic: false,
      choicePool: makeChoiceIndices(wordIndex, allIndices, allIndices),
      progressPct: progressForFormal(3, state.qIndex, wordCount),
      scoreLabel: `${state.score} correct`,
      mode: "choices",
      reviewLabel: prompt.reviewLabel,
    };
  }

  if (round === 4) {
    return {
      kind: "formal",
      wordIndex,
      sourceBlock: prompt.item.sourceBlock,
      sourceWordIndex: prompt.item.sourceWordIndex,
      round: 4,
      counter: `Question ${state.qIndex + 1} of ${state.order.length}`,
      roundLabel: ROUND_LABELS[4],
      instruction: "LISTEN AND TYPE THE MEANING",
      showMnemonic: false,
      choicePool: [],
      progressPct: progressForFormal(4, state.qIndex, wordCount),
      scoreLabel: `${state.score} correct`,
      mode: "type-english",
      reviewLabel: prompt.reviewLabel,
    };
  }

  return {
    kind: "formal",
    wordIndex,
    sourceBlock: prompt.item.sourceBlock,
    sourceWordIndex: prompt.item.sourceWordIndex,
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
    reviewLabel: prompt.reviewLabel,
  };
}

function buildRoundCompleteView(
  state: JapaneseSessionState,
  words: JapaneseWord[],
  round: 1 | 2 | 3 | 4 | 5,
  knownIndices: number[] = [],
): JapaneseRoundView {
  const wordCount = words.length;
  const known = new Set(knownIndices);
  const retiredOnly = (state.sessionRetired ?? []).filter((i) => !known.has(i)).length;
  const scorePct =
    round === 1
      ? 100
      : computeFormalRoundScorePct(
          state.score + retiredOnly,
          Math.max(
            state.order.filter((id) => typeof id === "number" && id >= 0 && id < wordCount)
              .length,
            state.roundIsRetry ? 1 : wordCount,
          ),
          wordCount,
          knownIndices,
          true,
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
  skipIndices: ReadonlySet<number> | readonly number[] = [],
): JapaneseSessionState {
  const skip = skipIndices instanceof Set ? skipIndices : new Set(skipIndices);
  if (state.inMini) {
    const next = { ...state, miniIndex: state.miniIndex + 1 };
    if (next.miniIndex >= next.miniQueue.length) {
      return { ...next, inMini: false, miniIndex: 0, miniQueue: [] };
    }
    return next;
  }

  let nextIntro = state.introIndex + 1;
  if (!isRound1RetryQueue(state) && skip.size > 0) {
    nextIntro = skipKnownIntroIndex(nextIntro, wordCount, skip);
  }
  const target = round1TargetCount(state, wordCount);
  if (nextIntro > 0 && nextIntro % JAPANESE_BATCH_SIZE === 0 && nextIntro < target) {
    const pool = round1LearnedPool({ ...state, introIndex: nextIntro }).filter(
      (i) => !skip.has(i),
    );
    const miniQueue = shuffle(pool).slice(0, Math.min(JAPANESE_MINI_REVIEW_SIZE, pool.length));
    return {
      ...state,
      introIndex: nextIntro,
      inMini: miniQueue.length > 0,
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
  options?: Omit<FormalRoundOptions, "knownIndices" | "isRetry">,
): JapaneseSessionState {
  const skip = options?.skipIndices ?? knownIndices;
  if (state.phase === "round1") {
    return startRound1Retry(wordCount, skip);
  }
  const round = roundNumber(state.phase);
  if (round >= 2 && round <= 5) {
    return startFormalRound(state, round as 2 | 3 | 4 | 5, wordCount, {
      isRetry: true,
      knownIndices,
      skipIndices: skip,
      blockNumber: options?.blockNumber,
      priorLearning: options?.priorLearning,
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
  options?: Omit<FormalRoundOptions, "knownIndices" | "isRetry">,
): JapaneseSessionState {
  if (round === 1) {
    if (!state.inMini && state.introIndex >= wordCount) {
      return { ...createInitialSessionState(), introIndex: wordCount, phase: "round1" };
    }
    const skip = options?.skipIndices ?? knownIndices;
    return startRound1Retry(wordCount, skip);
  }
  const base: JapaneseSessionState = {
    ...state,
    introIndex: Math.max(state.introIndex, wordCount),
  };
  return startFormalRound(base, round, wordCount, {
    knownIndices,
    skipIndices: options?.skipIndices ?? knownIndices,
    blockNumber: options?.blockNumber,
    priorLearning: options?.priorLearning,
  });
}



/** Start formal round n (2-5). Finite shuffled queue — never refilled. */
export type FormalRoundOptions = {
  isRetry?: boolean;
  knownIndices?: number[];
  /** Indices skipped from teaching / credited toward mastery. */
  skipIndices?: number[];
  blockNumber?: number;
  priorLearning?: PriorLearning;
};

export function startRound1Retry(
  wordCount: number,
  knownIndices: number[] = [],
): JapaneseSessionState {
  const pool = shufflePracticeOrder(buildLearnQueue(wordCount, knownIndices));
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
  options?: FormalRoundOptions | ReadonlySet<number>,
): JapaneseSessionState {
  let isRetry = false;
  let knownIndices: number[] = [];
  let skipIndices: number[] = [];
  let blockNumber = 1;
  let priorLearning: PriorLearning = emptyPriorLearning();

  if (options instanceof Set) {
    knownIndices = [...options];
    skipIndices = knownIndices;
  } else if (options) {
    const opts = options as FormalRoundOptions;
    isRetry = !!opts.isRetry;
    knownIndices = opts.knownIndices ?? [];
    skipIndices = opts.skipIndices ?? knownIndices;
    blockNumber = opts.blockNumber ?? 1;
    priorLearning = opts.priorLearning ?? emptyPriorLearning();
  }

  const credit = skipIndices.length ? skipIndices : knownIndices;
  let pool: number[];
  if (n >= 4) {
    pool = shufflePracticeOrder(
      buildReviewQueue(blockNumber, wordCount, credit, priorLearning),
    );
  } else {
    pool = shufflePracticeOrder(buildLearnQueue(wordCount, credit));
  }

  return {
    ...state,
    phase: `round${n}` as JapanesePhase,
    qIndex: 0,
    score: 0,
    missed: [],
    order: pool,
    // Always credit skipped/known words toward mastery once they are filtered out.
    roundIsRetry: isRetry || credit.length > 0,
    roundStreaks: {},
    sessionRetired: [],
  };
}

/** After round 1 completes, transition to round 2. */
export function transitionRound1ToRound2(
  state: JapaneseSessionState,
  wordCount: number,
  knownIndices: number[] = [],
  options?: Omit<FormalRoundOptions, "knownIndices" | "isRetry">,
): JapaneseSessionState {
  return startFormalRound({ ...state, introIndex: wordCount }, 2, wordCount, {
    isRetry: false,
    knownIndices,
    skipIndices: options?.skipIndices ?? knownIndices,
    blockNumber: options?.blockNumber,
    priorLearning: options?.priorLearning,
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
  const round = roundNumber(state.phase);
  let roundStreaks = state.roundStreaks;
  if (round === 4 || round === 5) {
    roundStreaks = { ...(state.roundStreaks ?? {}), [wordIndex]: 0 };
  }
  return {
    ...state,
    missed: [...state.missed, wordIndex],
    roundStreaks,
  };
}

/** Remove future occurrences of a word from the current formal round queue. */
export function retireWordFromFormalOrder(
  state: JapaneseSessionState,
  wordIndex: number,
): JapaneseSessionState {
  const retired = new Set(state.sessionRetired ?? []);
  retired.add(wordIndex);
  const order = state.order.filter(
    (idx, i) => i <= state.qIndex || idx !== wordIndex,
  );
  return { ...state, order, sessionRetired: [...retired] };
}

/** Record a correct answer; retires the word after 3-in-a-row in R4/R5. */
export function recordCorrectWithStreak(
  state: JapaneseSessionState,
  wordIndex: number,
): JapaneseSessionState {
  const round = roundNumber(state.phase);
  let next = recordCorrect(state);
  if (round !== 4 && round !== 5) return next;

  const streaks = { ...(next.roundStreaks ?? {}) };
  streaks[wordIndex] = (streaks[wordIndex] ?? 0) + 1;
  next = { ...next, roundStreaks: streaks };
  if (streaks[wordIndex] >= JAPANESE_KNOWN_THRESHOLD) {
    next = retireWordFromFormalOrder(next, wordIndex);
  }
  return next;
}

export function computeSessionRoundScorePct(
  state: JapaneseSessionState,
  wordCount: number,
  knownIndices: readonly number[],
): number {
  const round = roundNumber(state.phase);
  if (round === 1) return 100;
  const known = new Set(knownIndices);
  const retiredOnly = (state.sessionRetired ?? []).filter((i) => !known.has(i)).length;
  const effectiveScore = state.score + retiredOnly;
  return computeFormalRoundScorePct(
    effectiveScore,
    Math.max(state.order.filter((id) => isCurrentBlockOrderId(id, wordCount)).length, 1),
    wordCount,
    knownIndices,
    true,
  );
}

/** True when round 5 formal queue is finished (round-complete interstitial). */
export function isRound5SessionComplete(
  state: JapaneseSessionState,
): boolean {
  return (
    state.phase === "round5" &&
    state.order.length > 0 &&
    state.qIndex >= state.order.length
  );
}

/** Ensure block N+1 is in unlockedBlocks when block N is mastered. */
export function ensureNextBlockUnlockedAfterMastery(
  meta: JapaneseBlockMeta,
  blockNumber: number,
  revisionGatesPassed: readonly number[] = [],
): JapaneseBlockMeta {
  if (!meta.blockMastered || blockNumber >= JAPANESE_TOTAL_BLOCKS) return meta;
  const nextBlock = blockNumber + 1;
  if (
    meta.unlockedBlocks.includes(nextBlock) ||
    isBlockBehindRevisionGate(nextBlock, revisionGatesPassed)
  ) {
    return meta;
  }
  return { ...meta, unlockedBlocks: [...meta.unlockedBlocks, nextBlock] };
}

/**
 * Apply mastery + next-block unlock when session is stuck at a passed round 5
 * complete screen but DB meta was never updated (e.g. refresh before save).
 */
export function syncMasteryFromCompletedRound5(
  sessionState: JapaneseSessionState,
  meta: JapaneseBlockMeta,
  blockNumber: number,
  wordCount: number,
  knownIndices: readonly number[],
  revisionGatesPassed: readonly number[] = [],
): JapaneseBlockMeta {
  if (!isRound5SessionComplete(sessionState)) {
    return ensureNextBlockUnlockedAfterMastery(meta, blockNumber, revisionGatesPassed);
  }
  const scorePct = computeSessionRoundScorePct(sessionState, wordCount, knownIndices);
  if (scorePct < JAPANESE_MASTERY_THRESHOLD) return meta;
  const updated = updateMetaAfterRound(
    meta,
    blockNumber,
    5,
    scorePct,
    revisionGatesPassed,
  );
  return ensureNextBlockUnlockedAfterMastery(updated, blockNumber, revisionGatesPassed);
}

/** Update block meta after completing a formal round. */
export function updateMetaAfterRound(
  meta: JapaneseBlockMeta,
  blockNumber: number,
  round: 2 | 3 | 4 | 5,
  scorePct: number,
  revisionGatesPassed: readonly number[] = [],
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
      if (
        nextBlock <= JAPANESE_TOTAL_BLOCKS &&
        !unlockedBlocks.includes(nextBlock) &&
        !isBlockBehindRevisionGate(nextBlock, revisionGatesPassed)
      ) {
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
    roundStreaks: {},
    sessionRetired: [],
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
    unlockedBlocks: row.unlockedBlocks.length ? row.unlockedBlocks : [1, 2, 3, 4],
  };
}

/** Recover session stuck at end of round 1 or with empty formal queue. */
export function repairSessionState(
  state: JapaneseSessionState,
  wordCount: number,
  knownIndices: number[] = [],
  options?: {
    blockNumber?: number;
    priorLearning?: PriorLearning;
    skipIndices?: number[];
  },
): JapaneseSessionState {
  const skip = options?.skipIndices ?? knownIndices;
  const skipSet = new Set(skip);

  if (state.phase === "round1" && !state.inMini) {
    if (state.introIndex >= wordCount) {
      return state;
    }
    if (!isRound1RetryQueue(state) && skipSet.size > 0) {
      const nextIntro = skipKnownIntroIndex(state.introIndex, wordCount, skipSet);
      if (nextIntro !== state.introIndex) {
        return { ...state, introIndex: nextIntro };
      }
    }
    return state;
  }

  const round = roundNumber(state.phase);
  if (round >= 2 && state.order.length > 0 && state.qIndex >= state.order.length) {
    return state;
  }

  if (round >= 2 && state.order.length === 0) {
    return startFormalRound(state, round as 2 | 3 | 4 | 5, wordCount, {
      isRetry: !!state.roundIsRetry,
      knownIndices,
      skipIndices: skip,
      blockNumber: options?.blockNumber,
      priorLearning: options?.priorLearning,
    });
  }

  if (round >= 2 && state.qIndex > state.order.length) {
    return { ...state, qIndex: state.order.length };
  }

  return state;
}
