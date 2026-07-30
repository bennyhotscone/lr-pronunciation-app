import { matchPairWords } from "@/lib/recognition/normalizeTranscript";
import type { WordRecognitionProvider } from "@/lib/recognition/types";

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

export const browserSpeechProvider: WordRecognitionProvider = {
  isSupported() {
    return getSpeechRecognitionConstructor() !== null;
  },

  recognize({ targetWord, otherWord, lang = "en-US", signal }) {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      return Promise.resolve("unsupported" as const);
    }

    return new Promise((resolve) => {
      let settled = false;
      const recognition = new Recognition();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;

      const finish = (
        outcome:
          | "target"
          | "other"
          | "unclear"
          | "unsupported"
          | "error",
      ) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", onAbort);
        try {
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
          recognition.abort();
        } catch {
          // ignore cleanup errors
        }
        resolve(outcome);
      };

      const onAbort = () => finish("error");

      if (signal) {
        if (signal.aborted) {
          finish("error");
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }

      recognition.onresult = (event) => {
        const chunks: string[] = [];
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result?.[0]?.transcript) {
            chunks.push(result[0].transcript);
          }
        }
        const transcript = chunks.join(" ").trim();
        finish(matchPairWords(transcript, targetWord, otherWord));
      };

      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          finish("unsupported");
          return;
        }
        if (event.error === "no-speech" || event.error === "aborted") {
          finish("unclear");
          return;
        }
        finish("error");
      };

      recognition.onend = () => {
        if (!settled) finish("unclear");
      };

      try {
        recognition.start();
      } catch {
        finish("error");
      }
    });
  },
};
