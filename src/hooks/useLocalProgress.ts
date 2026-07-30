"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { clearProgress, loadProgress, saveProgress } from "@/lib/storage";
import { clampSequence } from "@/lib/pair-utils";
import {
  DEFAULT_PROGRESS,
  type LearnerLanguage,
  type ProgressState,
} from "@/types/progress";

type Store = {
  progress: ProgressState;
  recovered: boolean;
};

let store: Store = {
  progress: { ...DEFAULT_PROGRESS },
  recovered: false,
};
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  const loaded = loadProgress();
  store = { progress: loaded.progress, recovered: loaded.recovered };
  hydrated = true;
}

function getStoreSnapshot(): Store {
  ensureHydrated();
  return store;
}

function getServerSnapshot(): Store {
  return { progress: { ...DEFAULT_PROGRESS }, recovered: false };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeStore(next: Store) {
  store = next;
  saveProgress(next.progress);
  emit();
}

export function useLocalProgress() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getStoreSnapshot,
    getServerSnapshot,
  );

  const ready = useSyncExternalStore(
    subscribe,
    () => {
      ensureHydrated();
      return true;
    },
    () => false,
  );

  const setLanguage = useCallback((language: LearnerLanguage) => {
    ensureHydrated();
    writeStore({
      ...store,
      progress: { ...store.progress, language },
    });
  }, []);

  const setCurrentSequence = useCallback((sequence: number) => {
    ensureHydrated();
    writeStore({
      ...store,
      progress: {
        ...store.progress,
        currentSequence: clampSequence(sequence),
      },
    });
  }, []);

  const recordListeningAttempt = useCallback(
    (opts: { pairId: string; correct: boolean }) => {
      ensureHydrated();
      const confusedPairIds = { ...store.progress.listening.confusedPairIds };
      if (!opts.correct) {
        confusedPairIds[opts.pairId] = (confusedPairIds[opts.pairId] ?? 0) + 1;
      }
      writeStore({
        ...store,
        progress: {
          ...store.progress,
          listening: {
            attempts: store.progress.listening.attempts + 1,
            correct:
              store.progress.listening.correct + (opts.correct ? 1 : 0),
            confusedPairIds,
          },
        },
      });
    },
    [],
  );

  const recordSpeakingAttempt = useCallback(() => {
    ensureHydrated();
    writeStore({
      ...store,
      progress: {
        ...store.progress,
        speaking: {
          attempts: store.progress.speaking.attempts + 1,
        },
      },
    });
  }, []);

  const recordRecognitionConfusion = useCallback((pairId: string) => {
    ensureHydrated();
    const confusedPairIds = { ...store.progress.listening.confusedPairIds };
    confusedPairIds[pairId] = (confusedPairIds[pairId] ?? 0) + 1;
    writeStore({
      ...store,
      progress: {
        ...store.progress,
        listening: {
          ...store.progress.listening,
          confusedPairIds,
        },
      },
    });
  }, []);

  const resetProgress = useCallback(() => {
    ensureHydrated();
    const nextProgress = {
      ...DEFAULT_PROGRESS,
      language: store.progress.language,
    };
    clearProgress();
    writeStore({ progress: nextProgress, recovered: false });
  }, []);

  return useMemo(
    () => ({
      progress: snapshot.progress,
      ready,
      recovered: snapshot.recovered,
      setLanguage,
      setCurrentSequence,
      recordListeningAttempt,
      recordSpeakingAttempt,
      recordRecognitionConfusion,
      resetProgress,
    }),
    [
      snapshot,
      ready,
      setLanguage,
      setCurrentSequence,
      recordListeningAttempt,
      recordSpeakingAttempt,
      recordRecognitionConfusion,
      resetProgress,
    ],
  );
}
