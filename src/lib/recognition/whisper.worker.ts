/// <reference lib="webworker" />

import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from "@huggingface/transformers";

type WorkerRequest =
  | { id: number; type: "load" }
  | {
      id: number;
      type: "transcribe";
      audio: Float32Array;
      /** Soft prompt hinting the pair — Whisper may still invent other words. */
      candidates?: [string, string];
    };

type WorkerResponse =
  | {
      id: number;
      type: "ready";
      backend: "webgpu" | "wasm";
      modelId: string;
    }
  | { id: number; type: "progress"; progress: number }
  | { id: number; type: "result"; transcript: string }
  | { id: number; type: "error"; message: string };

const workerScope = self as DedicatedWorkerGlobalScope;

/**
 * Whisper Tiny.en is ~40MB and runs on phones, but it is weak at L/R contrasts.
 * Base.en (q8) is larger (~150MB first download) but noticeably better for
 * short single-word utterances — worth it for the app's core feature.
 */
const MODEL_ID = "onnx-community/whisper-base.en";
const DTYPE = {
  encoder_model: "fp32",
  decoder_model_merged: "q8",
} as const;

env.allowLocalModels = false;
// Prefer CDN caches so the first download is shared across visits.
env.useBrowserCache = true;

let transcriberPromise: Promise<{
  pipeline: AutomaticSpeechRecognitionPipeline;
  backend: "webgpu" | "wasm";
}> | null = null;
let activeLoadId: number | null = null;

async function createTranscriber(
  device: "webgpu" | "wasm",
  onProgress?: (progress: number) => void,
): Promise<AutomaticSpeechRecognitionPipeline> {
  return pipeline("automatic-speech-recognition", MODEL_ID, {
    device,
    dtype: DTYPE,
    progress_callback: (info: ProgressInfo) => {
      if (!onProgress) return;
      if (
        "progress" in info &&
        typeof info.progress === "number" &&
        Number.isFinite(info.progress)
      ) {
        onProgress(Math.max(0, Math.min(100, info.progress)));
      }
    },
  });
}

function getTranscriber(loadId?: number) {
  if (!transcriberPromise) {
    activeLoadId = loadId ?? null;
    transcriberPromise = (async () => {
      const report = (progress: number) => {
        if (activeLoadId === null) return;
        workerScope.postMessage({
          id: activeLoadId,
          type: "progress",
          progress,
        } satisfies WorkerResponse);
      };

      if ("gpu" in navigator) {
        try {
          const pipe = await createTranscriber("webgpu", report);
          return { pipeline: pipe, backend: "webgpu" as const };
        } catch (error) {
          // WebGPU init can fail on partial implementations — fall back.
          console.warn(
            "[whisper.worker] WebGPU unavailable, falling back to WASM",
            error,
          );
        }
      }
      const pipe = await createTranscriber("wasm", report);
      return { pipeline: pipe, backend: "wasm" as const };
    })().catch((error) => {
      transcriberPromise = null;
      throw error;
    });
  } else if (loadId !== undefined) {
    activeLoadId = loadId;
  }
  return transcriberPromise;
}

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id } = event.data;

  try {
    const loaded = await getTranscriber(
      event.data.type === "load" ? id : undefined,
    );

    if (event.data.type === "load") {
      workerScope.postMessage({
        id,
        type: "ready",
        backend: loaded.backend,
        modelId: MODEL_ID,
      } satisfies WorkerResponse);
      return;
    }

    // English-only models REJECT language/task options — do not pass them.
    // Soft-prompt with the two candidate words so the decoder is biased toward
    // the forced-choice vocabulary without claiming phoneme-level accuracy.
    const [left, right] = event.data.candidates ?? [];
    const prompt =
      left && right
        ? `${left}. ${right}.`
        : undefined;

    const output = await loaded.pipeline(event.data.audio, {
      // Keep clips short — our recordings are ≤3s.
      chunk_length_s: 5,
      return_timestamps: false,
      ...(prompt ? { prompt } : {}),
    });

    const transcript = Array.isArray(output)
      ? output.map((item) => item.text).join(" ")
      : output.text;

    workerScope.postMessage({
      id,
      type: "result",
      transcript: transcript ?? "",
    } satisfies WorkerResponse);
  } catch (error) {
    if (event.data.type === "load") {
      transcriberPromise = null;
    }
    workerScope.postMessage({
      id,
      type: "error",
      message: error instanceof Error ? error.message : "Transcription failed",
    } satisfies WorkerResponse);
  }
};

export {};
