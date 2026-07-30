"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { onDeviceWhisperProvider } from "@/lib/recognition/onDeviceWhisperProvider";
import type {
  RecognitionOutcome,
  WordRecognitionProvider,
} from "@/lib/recognition/types";

const emptySubscribe = () => () => {};

export function useSpeechRecognition(
  provider: WordRecognitionProvider = onDeviceWhisperProvider,
) {
  const supported = useSyncExternalStore(
    emptySubscribe,
    () => provider.isSupported(),
    () => false,
  );
  const [outcome, setOutcome] = useState<RecognitionOutcome>("idle");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setOutcome("idle");
  }, []);

  const recognize = useCallback(
    async (opts: { targetWord: string; otherWord: string }) => {
      if (!provider.isSupported()) {
        setOutcome("unsupported");
        return "unsupported" as const;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setOutcome("listening");

      const result = await provider.recognize({
        ...opts,
        lang: "en-US",
        signal: controller.signal,
      });

      if (abortRef.current !== controller) {
        return result;
      }

      setOutcome(result);
      return result;
    },
    [provider],
  );

  return {
    outcome,
    supported,
    recognize,
    reset,
    isListening: outcome === "listening",
  };
}
