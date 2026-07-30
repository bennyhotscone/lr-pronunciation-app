"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  cancelSpeech,
  isSpeechSynthesisSupported,
  speakWord,
  type SpeakStatus,
} from "@/lib/speech";

const emptySubscribe = () => () => {};

export function useSpeechSynthesis() {
  const supported = useSyncExternalStore(
    emptySubscribe,
    () => isSpeechSynthesisSupported(),
    () => false,
  );
  const [status, setStatus] = useState<SpeakStatus>("idle");
  const generationRef = useRef(0);

  useEffect(() => {
    return () => {
      cancelSpeech();
    };
  }, []);

  const speak = useCallback(async (word: string) => {
    if (!isSpeechSynthesisSupported()) {
      setStatus("unsupported");
      return "unsupported" as const;
    }

    const generation = ++generationRef.current;
    setStatus("speaking");
    const result = await speakWord(word);
    if (generation !== generationRef.current) {
      return result;
    }
    setStatus(result === "idle" ? "idle" : result);
    return result;
  }, []);

  const cancel = useCallback(() => {
    generationRef.current += 1;
    cancelSpeech();
    setStatus("idle");
  }, []);

  return { speak, cancel, status, supported };
}
