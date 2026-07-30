import { canDecodeAudio, decodeBlobToPcm } from "@/lib/recognition/audio";
import { matchPairWords } from "@/lib/recognition/normalizeTranscript";
import type {
  RecognitionBackend,
  RecognitionDiagnostics,
  RecognitionOutcome,
  RecognizeOptions,
  WordRecognitionProvider,
} from "@/lib/recognition/types";
import { EMPTY_DIAGNOSTICS } from "@/lib/recognition/types";

type WorkerResponse =
  | {
      id: number;
      type: "ready";
      backend: RecognitionBackend;
      modelId: string;
    }
  | { id: number; type: "progress"; progress: number }
  | { id: number; type: "result"; transcript: string }
  | { id: number; type: "error"; message: string };

type PendingRequest = {
  resolve: (value: WorkerResponse) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number) => void;
};

let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<number, PendingRequest>();

const diagnostics: RecognitionDiagnostics = { ...EMPTY_DIAGNOSTICS };

function updateDiagnostics(patch: Partial<RecognitionDiagnostics>) {
  Object.assign(diagnostics, patch);
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const request = pending.get(event.data.id);
      if (!request) return;

      if (event.data.type === "progress") {
        request.onProgress?.(event.data.progress);
        updateDiagnostics({ loadProgress: event.data.progress });
        return;
      }

      pending.delete(event.data.id);
      if (event.data.type === "error") {
        request.reject(new Error(event.data.message));
      } else {
        request.resolve(event.data);
      }
    };
    worker.onerror = (event) => {
      const message = event.message || "On-device model worker failed";
      for (const request of pending.values()) {
        request.reject(new Error(message));
      }
      pending.clear();
      updateDiagnostics({
        modelLoaded: false,
        lastError: message,
        statusMessage: "Worker crashed while loading the on-device model.",
      });
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

function requestWorker(
  message:
    | { type: "load" }
    | {
        type: "transcribe";
        audio: Float32Array;
        candidates?: [string, string];
      },
  onProgress?: (progress: number) => void,
): Promise<WorkerResponse> {
  const id = ++nextRequestId;
  const modelWorker = getWorker();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    if (message.type === "transcribe") {
      // Copy before transfer so the caller can keep using the original buffer.
      const transferable = message.audio.slice();
      modelWorker.postMessage(
        { ...message, audio: transferable, id },
        [transferable.buffer],
      );
    } else {
      modelWorker.postMessage({ ...message, id });
    }
  });
}

async function ensureModel(
  onProgress?: (progress: number | null) => void,
  onStatus?: (message: string) => void,
): Promise<{ backend: RecognitionBackend; modelId: string }> {
  if (diagnostics.modelLoaded && diagnostics.modelId) {
    onProgress?.(100);
    return {
      backend: diagnostics.backend,
      modelId: diagnostics.modelId,
    };
  }

  onStatus?.(
    "Loading the on-device model… first time only (stays on this device).",
  );
  updateDiagnostics({
    statusMessage: "Downloading / loading on-device model…",
    loadProgress: 0,
    lastError: "",
  });
  onProgress?.(0);

  try {
    const response = await requestWorker({ type: "load" }, (progress) => {
      onProgress?.(progress);
      updateDiagnostics({ loadProgress: progress });
    });
    if (response.type !== "ready") {
      throw new Error("Unexpected worker response while loading the model");
    }
    updateDiagnostics({
      modelLoaded: true,
      modelId: response.modelId,
      backend: response.backend,
      loadProgress: 100,
      statusMessage: `Model ready (${response.backend}).`,
      lastError: "",
    });
    onProgress?.(100);
    onStatus?.("Model ready. Checking your recording…");
    return { backend: response.backend, modelId: response.modelId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load on-device model";
    updateDiagnostics({
      modelLoaded: false,
      lastError: message,
      statusMessage: "Recognition unavailable — model failed to load.",
      loadProgress: null,
    });
    throw error;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function classifyMediaError(
  error: unknown,
): Exclude<RecognitionOutcome, "idle" | "listening" | "loading"> {
  if (error instanceof DOMException) {
    if (
      error.name === "NotAllowedError" ||
      error.name === "SecurityError" ||
      error.name === "NotFoundError" ||
      error.name === "NotReadableError" ||
      error.name === "DevicesNotFoundError"
    ) {
      return "unsupported";
    }
    if (error.name === "AbortError") return "error";
  }
  return "error";
}

export const onDeviceWhisperProvider: WordRecognitionProvider = {
  isSupported() {
    return (
      typeof window !== "undefined" &&
      typeof Worker !== "undefined" &&
      canDecodeAudio() &&
      Boolean(
        // Recording OR a synthetic PCM path is enough for support checks.
        navigator.mediaDevices?.getUserMedia || true,
      )
    );
  },

  getDiagnostics() {
    return { ...diagnostics };
  },

  async preload(onProgress) {
    return ensureModel(onProgress);
  },

  async recognize({
    targetWord,
    otherWord,
    signal,
    audioBlob,
    audioSamples,
    onStatus,
    onProgress,
    onDiagnostics,
  }: RecognizeOptions): Promise<
    Exclude<RecognitionOutcome, "idle" | "listening" | "loading">
  > {
    const publish = (patch: Partial<RecognitionDiagnostics>) => {
      updateDiagnostics(patch);
      onDiagnostics?.({ ...diagnostics });
    };

    if (!this.isSupported()) {
      publish({
        lastOutcome: "unsupported",
        lastError: "Browser missing Worker or AudioContext support.",
        statusMessage: "Recognition unavailable in this browser.",
      });
      return "unsupported";
    }

    if (!audioBlob && !audioSamples) {
      publish({
        lastOutcome: "unsupported",
        lastError: "No recording provided.",
        statusMessage:
          "Record yourself first, then the check reuses that recording.",
      });
      return "unsupported";
    }

    try {
      await ensureModel(onProgress, onStatus);
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      onStatus?.("Preparing your recording…");
      publish({ statusMessage: "Decoding recording…" });

      let samples: Float32Array;
      if (audioSamples) {
        samples = audioSamples;
      } else if (audioBlob) {
        const prepared = await decodeBlobToPcm(audioBlob);
        if (prepared.silent) {
          publish({
            lastTranscript: "",
            lastOutcome: "unclear",
            lastError: "",
            statusMessage:
              "Recording was too quiet. Try again closer to the mic.",
          });
          return "unclear";
        }
        samples = prepared.samples;
      } else {
        return "unsupported";
      }

      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      onStatus?.("Checking with the on-device model…");
      publish({ statusMessage: "Running on-device transcription…" });

      // Copy — the worker transfers the ArrayBuffer away.
      const audioForWorker = samples.slice();
      const response = await requestWorker({
        type: "transcribe",
        audio: audioForWorker,
        candidates: [targetWord, otherWord],
      });

      if (response.type !== "result") {
        throw new Error("Unexpected worker response during transcription");
      }

      const transcript = response.transcript ?? "";
      const outcome = matchPairWords(transcript, targetWord, otherWord);
      publish({
        lastTranscript: transcript,
        lastOutcome: outcome,
        lastError: "",
        statusMessage:
          outcome === "unclear"
            ? `Heard “${transcript.trim() || "(silence)"}” — not close enough to either word.`
            : `Heard “${transcript.trim()}”.`,
      });
      return outcome;
    } catch (error) {
      if (isAbortError(error)) {
        publish({
          lastOutcome: "error",
          lastError: "Aborted",
          statusMessage: "Check cancelled.",
        });
        return "error";
      }

      const outcome = classifyMediaError(error);
      const message =
        error instanceof Error ? error.message : "Recognition failed";
      publish({
        lastOutcome: outcome,
        lastError: message,
        statusMessage:
          outcome === "unsupported"
            ? `Recognition unavailable: ${message}`
            : `Error: ${message}`,
      });
      return outcome;
    }
  },
};

/** Test-only helper: reset module diagnostics between Vitest cases. */
export function __resetWhisperDiagnosticsForTests() {
  Object.assign(diagnostics, EMPTY_DIAGNOSTICS);
}
