import {
  HISTORY_LIMIT,
  QUESTION_COUNTS,
  STORE_VERSION,
  STORAGE_KEY,
  type AppView,
  type CompletedAttempt,
  type Difficulty,
  type FeedbackMode,
  type InProgressAttempt,
  type LantiteStore,
  type QuestionCount,
  type TestKind,
  type TimerState,
} from "@/lib/lantite/types";

export interface LoadResult {
  store: LantiteStore;
  recovered: boolean;
  migrated: boolean;
}

const KINDS: readonly TestKind[] = ["reading", "conventions", "mixed", "pitfalls", "exam"];
const DIFFICULTIES: readonly Difficulty[] = ["easy", "standard", "challenging"];
const FEEDBACK: readonly FeedbackMode[] = ["practice", "exam"];
const VIEWS: readonly AppView[] = ["setup", "sit", "results", "review", "progress"];

export function emptyStore(): LantiteStore {
  return {
    version: STORE_VERSION,
    history: [],
    inProgress: null,
    ui: { view: "setup", activeAttemptId: null, reviewIndex: 0 },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asCount(value: unknown): QuestionCount {
  return QUESTION_COUNTS.includes(value as QuestionCount) ? (value as QuestionCount) : 10;
}

function asKind(value: unknown): TestKind {
  return KINDS.includes(value as TestKind) ? (value as TestKind) : "mixed";
}

function asDifficulty(value: unknown): Difficulty {
  return DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : "standard";
}

function asFeedback(value: unknown): FeedbackMode {
  return FEEDBACK.includes(value as FeedbackMode) ? (value as FeedbackMode) : "exam";
}

function asView(value: unknown): AppView {
  return VIEWS.includes(value as AppView) ? (value as AppView) : "setup";
}

function asAnswers(value: unknown): Record<string, number | null> {
  if (!isRecord(value)) return {};
  const answers: Record<string, number | null> = {};
  for (const [key, answer] of Object.entries(value)) {
    if (answer == null) answers[key] = null;
    else if (typeof answer === "number" && answer >= 0 && answer <= 3) answers[key] = answer;
  }
  return answers;
}

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asTimer(value: unknown): TimerState {
  if (!isRecord(value)) return { elapsedMs: 0, running: false, lastResumedAt: null };
  const elapsedMs = typeof value.elapsedMs === "number" && value.elapsedMs >= 0 ? value.elapsedMs : 0;
  const running = value.running === true;
  const lastResumedAt = typeof value.lastResumedAt === "number" ? value.lastResumedAt : null;
  return { elapsedMs, running, lastResumedAt: running ? lastResumedAt : null };
}

function asConfig(value: unknown) {
  const record = isRecord(value) ? value : {};
  const seed = typeof record.seed === "number" && Number.isFinite(record.seed) ? Math.floor(record.seed) : 1;
  return {
    kind: asKind(record.kind),
    count: asCount(record.count),
    difficulty: asDifficulty(record.difficulty),
    timed: record.timed === true,
    feedback: asFeedback(record.feedback),
    seed: seed || 1,
  };
}

function asInProgress(value: unknown): InProgressAttempt | null {
  if (!isRecord(value)) return null;
  const questionIds = asIdList(value.questionIds);
  if (questionIds.length === 0 || typeof value.id !== "string") return null;
  const current = typeof value.currentIndex === "number" ? Math.floor(value.currentIndex) : 0;
  return {
    id: value.id,
    config: asConfig(value.config),
    questionIds,
    answers: asAnswers(value.answers),
    flagged: asIdList(value.flagged),
    currentIndex: Math.min(Math.max(0, current), questionIds.length - 1),
    startedAt: typeof value.startedAt === "number" ? value.startedAt : Date.now(),
    timer: asTimer(value.timer),
    bankVersion: typeof value.bankVersion === "number" ? value.bankVersion : 1,
  };
}

function asCompleted(value: unknown): CompletedAttempt | null {
  if (!isRecord(value)) return null;
  const questionIds = asIdList(value.questionIds);
  if (questionIds.length === 0 || typeof value.id !== "string") return null;
  return {
    id: value.id,
    config: asConfig(value.config),
    questionIds,
    answers: asAnswers(value.answers),
    flagged: asIdList(value.flagged),
    startedAt: typeof value.startedAt === "number" ? value.startedAt : 0,
    completedAt: typeof value.completedAt === "number" ? value.completedAt : 0,
    elapsedMs: typeof value.elapsedMs === "number" && value.elapsedMs >= 0 ? value.elapsedMs : 0,
    timedOut: value.timedOut === true,
    bankVersion: typeof value.bankVersion === "number" ? value.bankVersion : 1,
  };
}

export function migrateStore(raw: unknown): { store: LantiteStore; migrated: boolean } {
  if (!isRecord(raw)) throw new Error("Store was not an object");
  const version = raw.version;
  const migrated = version !== STORE_VERSION;
  if (version !== undefined && version !== 1 && version !== STORE_VERSION && !Array.isArray(raw.history)) {
    throw new Error("Unrecognised store");
  }
  const history = Array.isArray(raw.history)
    ? raw.history.map(asCompleted).filter((item): item is CompletedAttempt => item != null)
    : [];
  const ui = isRecord(raw.ui) ? raw.ui : {};
  const store: LantiteStore = {
    version: STORE_VERSION,
    history: history.slice(-HISTORY_LIMIT),
    inProgress: asInProgress(raw.inProgress),
    ui: {
      view: asView(ui.view),
      activeAttemptId: typeof ui.activeAttemptId === "string" ? ui.activeAttemptId : null,
      reviewIndex: typeof ui.reviewIndex === "number" && ui.reviewIndex >= 0 ? Math.floor(ui.reviewIndex) : 0,
    },
  };
  if (store.ui.view === "sit" && !store.inProgress) store.ui.view = "setup";
  if ((store.ui.view === "results" || store.ui.view === "review") && store.ui.activeAttemptId) {
    const exists = store.history.some((item) => item.id === store.ui.activeAttemptId);
    if (!exists) store.ui = { view: "setup", activeAttemptId: null, reviewIndex: 0 };
  }
  return { store, migrated: migrated || version === undefined };
}

export function loadStore(raw: string | null): LoadResult {
  if (raw == null || raw.trim() === "") return { store: emptyStore(), recovered: false, migrated: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    const { store, migrated } = migrateStore(parsed);
    return { store, recovered: false, migrated };
  } catch {
    return { store: emptyStore(), recovered: true, migrated: false };
  }
}

export function serializeStore(store: LantiteStore): string {
  const next: LantiteStore = {
    ...store,
    version: STORE_VERSION,
    history: store.history.slice(-HISTORY_LIMIT),
  };
  return JSON.stringify(next);
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readStored(storage: StorageLike): LoadResult {
  try {
    return loadStore(storage.getItem(STORAGE_KEY));
  } catch {
    return { store: emptyStore(), recovered: true, migrated: false };
  }
}

export function writeStored(storage: StorageLike, store: LantiteStore): { ok: true } | { ok: false; message: string } {
  try {
    storage.setItem(STORAGE_KEY, serializeStore(store));
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "This browser could not save the practice. It may be full, or storage may be blocked.",
    };
  }
}

export function clearStored(storage: StorageLike): void {
  storage.removeItem(STORAGE_KEY);
}
