import type {
  GrammarBlockMeta,
  GrammarGuidedQuestion,
  GrammarRecallQuestion,
  GrammarSessionState,
} from "./types";

export function createInitialGrammarSession(): GrammarSessionState {
  return {
    phase: "teach",
    guidedIndex: 0,
    recallIndex: 0,
    recallMode: "j-to-e",
    score: 0,
    missed: [],
  };
}

export function createInitialGrammarMeta(blockId: string): GrammarBlockMeta {
  return {
    teachCompleted: false,
    guidedCompleted: false,
    recallJtoECompleted: false,
    recallEtoJCompleted: false,
    mastered: false,
    unlockedBlocks: [blockId],
  };
}

export function getRecallQuestions(
  block: { recall: GrammarRecallQuestion[] },
  mode: GrammarSessionState["recallMode"],
): GrammarRecallQuestion[] {
  if (mode === "j-to-e") return block.recall.filter((q) => q.direction === "j-to-e");
  if (mode === "e-to-j") return block.recall.filter((q) => q.direction === "e-to-j");
  return block.recall;
}

export function completeTeachPhase(session: GrammarSessionState): GrammarSessionState {
  return { ...session, phase: "guided", guidedIndex: 0 };
}

export function advanceGuided(
  session: GrammarSessionState,
  total: number,
  correct: boolean,
  questionId: string,
): GrammarSessionState {
  const missed = correct ? session.missed : [...session.missed, questionId];
  const nextIndex = session.guidedIndex + 1;
  if (nextIndex >= total) {
    return {
      ...session,
      guidedIndex: nextIndex,
      phase: "recall",
      recallIndex: 0,
      recallMode: "j-to-e",
      score: correct ? session.score + 1 : session.score,
      missed,
    };
  }
  return {
    ...session,
    guidedIndex: nextIndex,
    score: correct ? session.score + 1 : session.score,
    missed,
  };
}

export function advanceRecall(
  session: GrammarSessionState,
  jToECount: number,
  eToJCount: number,
  correct: boolean,
  questionId: string,
): { session: GrammarSessionState; phaseComplete: boolean } {
  const missed = correct ? session.missed : [...session.missed, questionId];
  const score = correct ? session.score + 1 : session.score;
  const currentList =
    session.recallMode === "j-to-e"
      ? jToECount
      : session.recallMode === "e-to-j"
        ? eToJCount
        : jToECount + eToJCount;
  const nextIndex = session.recallIndex + 1;

  if (nextIndex < currentList) {
    return {
      session: { ...session, recallIndex: nextIndex, score, missed },
      phaseComplete: false,
    };
  }

  if (session.recallMode === "j-to-e") {
    return {
      session: {
        ...session,
        recallIndex: 0,
        recallMode: "e-to-j",
        score,
        missed,
      },
      phaseComplete: false,
    };
  }

  return {
    session: { ...session, recallIndex: nextIndex, score, missed },
    phaseComplete: true,
  };
}

export function checkGuidedAnswer(
  question: GrammarGuidedQuestion,
  input: string,
  selectedIndex?: number,
): boolean {
  switch (question.kind) {
    case "mc":
      return selectedIndex === question.answerIndex;
    case "fill": {
      const val = input.trim().toLowerCase();
      return question.answers.some((a) => a.trim().toLowerCase() === val);
    }
    case "reorder":
    case "build": {
      const norm = input.toLowerCase().replace(/\s+/g, " ").trim();
      return norm === question.answer.toLowerCase();
    }
    default:
      return false;
  }
}

export function updateGrammarMetaAfterComplete(
  meta: GrammarBlockMeta,
  blockId: string,
  jToEPassed: boolean,
  eToJPassed: boolean,
): GrammarBlockMeta {
  const recallJtoECompleted = meta.recallJtoECompleted || jToEPassed;
  const recallEtoJCompleted = meta.recallEtoJCompleted || eToJPassed;
  const mastered = recallJtoECompleted && recallEtoJCompleted;
  return {
    ...meta,
    teachCompleted: true,
    guidedCompleted: true,
    recallJtoECompleted,
    recallEtoJCompleted,
    mastered,
    unlockedBlocks: meta.unlockedBlocks.includes(blockId)
      ? meta.unlockedBlocks
      : [...meta.unlockedBlocks, blockId],
  };
}
