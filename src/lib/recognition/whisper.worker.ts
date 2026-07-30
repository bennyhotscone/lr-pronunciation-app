/// <reference lib="webworker" />

import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

type WorkerRequest =
  | { id: number; type: "load" }
  | { id: number; type: "transcribe"; audio: Float32Array };

type WorkerResponse =
  | { id: number; type: "ready" }
  | { id: number; type: "result"; transcript: string }
  | { id: number; type: "error"; message: string };

const workerScope = self as DedicatedWorkerGlobalScope;
const MODEL_ID = "onnx-community/whisper-tiny.en";
const DTYPE = {
  encoder_model: "fp32",
  decoder_model_merged: "q4",
} as const;

env.allowLocalModels = false;

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null =
  null;

async function createTranscriber(
  device: "webgpu" | "wasm",
): Promise<AutomaticSpeechRecognitionPipeline> {
  return pipeline("automatic-speech-recognition", MODEL_ID, {
    device,
    dtype: DTYPE,
  });
}

function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      if ("gpu" in navigator) {
        try {
          return await createTranscriber("webgpu");
        } catch {
          // Fall through to WASM when WebGPU init fails.
        }
      }
      return createTranscriber("wasm");
    })();
  }
  return transcriberPromise;
}

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id } = event.data;

  try {
    const transcriber = await getTranscriber();
    if (event.data.type === "load") {
      workerScope.postMessage({ id, type: "ready" } satisfies WorkerResponse);
      return;
    }

    const output = await transcriber(event.data.audio, {
      language: "en",
      task: "transcribe",
    });
    const transcript = Array.isArray(output)
      ? output.map((item) => item.text).join(" ")
      : output.text;

    workerScope.postMessage({
      id,
      type: "result",
      transcript,
    } satisfies WorkerResponse);
  } catch (error) {
    transcriberPromise = null;
    workerScope.postMessage({
      id,
      type: "error",
      message: error instanceof Error ? error.message : "Transcription failed",
    } satisfies WorkerResponse);
  }
};

export {};
