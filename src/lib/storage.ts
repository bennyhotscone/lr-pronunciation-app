import {
  DEFAULT_PROGRESS,
  PROGRESS_STORAGE_KEY,
  type LearnerLanguage,
  type ProgressState,
} from "@/types/progress";
import { clampSequence } from "@/lib/pair-utils";

function isLearnerLanguage(value: unknown): value is LearnerLanguage {
  return value === "ja" || value === "th" || value === "other";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseProgress(raw: string | null): {
  progress: ProgressState;
  recovered: boolean;
} {
  if (!raw) {
    return { progress: { ...DEFAULT_PROGRESS }, recovered: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) {
      return { progress: { ...DEFAULT_PROGRESS }, recovered: true };
    }

    const language = isLearnerLanguage(parsed.language)
      ? parsed.language
      : DEFAULT_PROGRESS.language;

    const currentSequence = clampSequence(
      typeof parsed.currentSequence === "number"
        ? parsed.currentSequence
        : DEFAULT_PROGRESS.currentSequence,
    );

    const listening = isRecord(parsed.listening) ? parsed.listening : {};
    const speaking = isRecord(parsed.speaking) ? parsed.speaking : {};
    const confusedRaw = isRecord(listening.confusedPairIds)
      ? listening.confusedPairIds
      : {};

    const confusedPairIds: Record<string, number> = {};
    for (const [key, value] of Object.entries(confusedRaw)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        confusedPairIds[key] = value;
      }
    }

    return {
      progress: {
        version: 1,
        language,
        currentSequence,
        listening: {
          attempts:
            typeof listening.attempts === "number" && listening.attempts >= 0
              ? listening.attempts
              : 0,
          correct:
            typeof listening.correct === "number" && listening.correct >= 0
              ? listening.correct
              : 0,
          confusedPairIds,
        },
        speaking: {
          attempts:
            typeof speaking.attempts === "number" && speaking.attempts >= 0
              ? speaking.attempts
              : 0,
        },
      },
      recovered: false,
    };
  } catch {
    return { progress: { ...DEFAULT_PROGRESS }, recovered: true };
  }
}

export function loadProgress(): {
  progress: ProgressState;
  recovered: boolean;
} {
  if (typeof window === "undefined") {
    return { progress: { ...DEFAULT_PROGRESS }, recovered: false };
  }
  return parseProgress(window.localStorage.getItem(PROGRESS_STORAGE_KEY));
}

export function saveProgress(progress: ProgressState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
}

export function clearProgress(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROGRESS_STORAGE_KEY);
}
