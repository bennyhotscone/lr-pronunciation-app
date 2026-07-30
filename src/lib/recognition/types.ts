export type RecognitionOutcome =
  | "idle"
  | "listening"
  | "loading"
  | "target"
  | "other"
  | "unclear"
  | "unsupported"
  | "error";

export type RecognitionResultLabel =
  | "Target recognised"
  | "Other word recognised"
  | "Unclear"
  | "Recognition unavailable"
  | "Error"
  | "Loading on-device model…"
  | "";

export function outcomeToLabel(outcome: RecognitionOutcome): RecognitionResultLabel {
  switch (outcome) {
    case "target":
      return "Target recognised";
    case "other":
      return "Other word recognised";
    case "unclear":
      return "Unclear";
    case "unsupported":
      return "Recognition unavailable";
    case "error":
      return "Error";
    case "loading":
      return "Loading on-device model…";
    default:
      return "";
  }
}

export type RecognitionBackend = "webgpu" | "wasm" | "unknown";

export interface RecognitionDiagnostics {
  modelLoaded: boolean;
  modelId: string;
  backend: RecognitionBackend;
  lastTranscript: string;
  lastOutcome: Exclude<RecognitionOutcome, "idle" | "listening" | "loading"> | "";
  lastError: string;
  loadProgress: number | null;
  statusMessage: string;
}

export const EMPTY_DIAGNOSTICS: RecognitionDiagnostics = {
  modelLoaded: false,
  modelId: "",
  backend: "unknown",
  lastTranscript: "",
  lastOutcome: "",
  lastError: "",
  loadProgress: null,
  statusMessage: "",
};

export interface RecognizeOptions {
  targetWord: string;
  otherWord: string;
  lang?: string;
  signal?: AbortSignal;
  /** Prefer the student's existing recording — do not open a second mic session. */
  audioBlob?: Blob;
  /** Already-decoded 16 kHz mono PCM (used by browser self-tests). */
  audioSamples?: Float32Array;
  onStatus?: (message: string) => void;
  onProgress?: (progress: number | null) => void;
  onDiagnostics?: (patch: Partial<RecognitionDiagnostics>) => void;
}

export interface WordRecognitionProvider {
  isSupported(): boolean;
  recognize(
    opts: RecognizeOptions,
  ): Promise<Exclude<RecognitionOutcome, "idle" | "listening" | "loading">>;
  /** Warm the model without recording. Safe to call multiple times. */
  preload?(
    onProgress?: (progress: number | null) => void,
  ): Promise<{ backend: RecognitionBackend; modelId: string }>;
  getDiagnostics?(): RecognitionDiagnostics;
}
