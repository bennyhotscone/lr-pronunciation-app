"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { onDeviceWhisperProvider } from "@/lib/recognition/onDeviceWhisperProvider";
import type {
  RecognitionDiagnostics,
  RecognitionOutcome,
  WordRecognitionProvider,
} from "@/lib/recognition/types";
import { EMPTY_DIAGNOSTICS } from "@/lib/recognition/types";

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
  const [statusMessage, setStatusMessage] = useState("");
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [diagnostics, setDiagnostics] =
    useState<RecognitionDiagnostics>(EMPTY_DIAGNOSTICS);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const syncDiagnostics = useCallback(() => {
    if (provider.getDiagnostics) {
      setDiagnostics(provider.getDiagnostics());
    }
  }, [provider]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setOutcome("idle");
    setStatusMessage("");
    setLoadProgress(null);
  }, []);

  const preload = useCallback(async () => {
    if (!provider.preload) return;
    setOutcome("loading");
    setStatusMessage(
      "Loading the on-device model… first time only (stays on this device).",
    );
    try {
      await provider.preload((progress) => setLoadProgress(progress));
      syncDiagnostics();
      setStatusMessage("On-device model ready.");
      setOutcome("idle");
    } catch (error) {
      syncDiagnostics();
      setOutcome("unsupported");
      setStatusMessage(
        error instanceof Error
          ? `Recognition unavailable: ${error.message}`
          : "Recognition unavailable — model failed to load.",
      );
    }
  }, [provider, syncDiagnostics]);

  const recognize = useCallback(
    async (opts: {
      targetWord: string;
      otherWord: string;
      audioBlob?: Blob;
      audioSamples?: Float32Array;
    }) => {
      if (!provider.isSupported()) {
        setOutcome("unsupported");
        setStatusMessage(
          "On-device recognition needs a modern browser with Web Workers.",
        );
        return "unsupported" as const;
      }

      if (!opts.audioBlob && !opts.audioSamples) {
        setOutcome("unsupported");
        setStatusMessage("Record yourself first, then tap Check.");
        return "unsupported" as const;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setOutcome("loading");
      setStatusMessage(
        "Loading the on-device model… first time only (stays on this device).",
      );
      setLoadProgress(null);

      const result = await provider.recognize({
        ...opts,
        lang: "en-US",
        signal: controller.signal,
        onStatus: (message) => {
          if (abortRef.current !== controller) return;
          setStatusMessage(message);
          if (message.toLowerCase().includes("loading")) {
            setOutcome("loading");
          } else {
            setOutcome("listening");
          }
        },
        onProgress: (progress) => {
          if (abortRef.current !== controller) return;
          setLoadProgress(progress);
        },
        onDiagnostics: (patch) => {
          if (abortRef.current !== controller) return;
          setDiagnostics((prev) => ({ ...prev, ...patch }));
        },
      });

      syncDiagnostics();

      if (abortRef.current !== controller) {
        return result;
      }

      setOutcome(result);
      setLoadProgress(null);
      return result;
    },
    [provider, syncDiagnostics],
  );

  return {
    outcome,
    supported,
    recognize,
    preload,
    reset,
    statusMessage,
    loadProgress,
    diagnostics,
    isBusy: outcome === "listening" || outcome === "loading",
    isListening: outcome === "listening" || outcome === "loading",
  };
}
