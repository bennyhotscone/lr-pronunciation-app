import { matchPairWords } from "@/lib/recognition/normalizeTranscript";
import type {
  RecognitionOutcome,
  WordRecognitionProvider,
} from "@/lib/recognition/types";

const RECORDING_MS = 2800;
const TARGET_SAMPLE_RATE = 16_000;

type WorkerResponse =
  | { id: number; type: "ready" }
  | { id: number; type: "result"; transcript: string }
  | { id: number; type: "error"; message: string };

let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<
  number,
  {
    resolve: (transcript: string) => void;
    reject: (error: Error) => void;
  }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const request = pending.get(event.data.id);
      if (!request) return;
      pending.delete(event.data.id);

      if (event.data.type === "error") {
        request.reject(new Error(event.data.message));
      } else {
        request.resolve(
          event.data.type === "result" ? event.data.transcript : "",
        );
      }
    };
    worker.onerror = () => {
      for (const request of pending.values()) {
        request.reject(new Error("On-device model worker failed"));
      }
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

function requestWorker(
  message: { type: "load" } | { type: "transcribe"; audio: Float32Array },
): Promise<string> {
  const id = ++nextRequestId;
  const modelWorker = getWorker();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    if (message.type === "transcribe") {
      modelWorker.postMessage({ ...message, id }, [message.audio.buffer]);
    } else {
      modelWorker.postMessage({ ...message, id });
    }
  });
}

function resample(input: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === TARGET_SAMPLE_RATE) return input;

  const outputLength = Math.round(
    input.length * (TARGET_SAMPLE_RATE / sourceRate),
  );
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / TARGET_SAMPLE_RATE;

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * ratio;
    const left = Math.floor(sourcePosition);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = sourcePosition - left;
    output[index] =
      input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

function prepareAudio(
  chunks: Float32Array[],
  sourceRate: number,
): Float32Array | null {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (length === 0) return null;

  const joined = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }

  let peak = 0;
  let energy = 0;
  for (const sample of joined) {
    const magnitude = Math.abs(sample);
    peak = Math.max(peak, magnitude);
    energy += sample * sample;
  }
  const rms = Math.sqrt(energy / joined.length);
  if (peak < 0.025 || rms < 0.004) return null;

  const resampled = resample(joined, sourceRate);
  const scale = Math.min(1 / peak, 4);
  if (scale > 1) {
    for (let index = 0; index < resampled.length; index += 1) {
      resampled[index] *= scale;
    }
  }
  return resampled;
}

async function captureAudio(signal?: AbortSignal): Promise<Float32Array | null> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const AudioContextConstructor =
    window.AudioContext ??
    (
      window as Window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextConstructor) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("Audio processing is unavailable");
  }

  const context = new AudioContextConstructor();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const mutedOutput = context.createGain();
  const chunks: Float32Array[] = [];

  mutedOutput.gain.value = 0;
  source.connect(processor);
  processor.connect(mutedOutput);
  mutedOutput.connect(context.destination);
  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };

  await context.resume();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => finish(), RECORDING_MS);

    const cleanup = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
      mutedOutput.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        reject(error);
      } else {
        resolve(prepareAudio(chunks, context.sampleRate));
      }
    };
    const onAbort = () => finish(new DOMException("Aborted", "AbortError"));

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export const onDeviceWhisperProvider: WordRecognitionProvider = {
  isSupported() {
    return (
      typeof window !== "undefined" &&
      typeof Worker !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      Boolean(
        window.AudioContext ||
          (
            window as Window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext,
      )
    );
  },

  async recognize({
    targetWord,
    otherWord,
    signal,
  }): Promise<Exclude<RecognitionOutcome, "idle" | "listening">> {
    if (!this.isSupported()) return "unsupported";

    try {
      const modelReady = requestWorker({ type: "load" });
      const audio = await captureAudio(signal);
      if (!audio) return "unclear";

      await modelReady;
      if (signal?.aborted) return "error";
      const transcript = await requestWorker({ type: "transcribe", audio });
      return matchPairWords(transcript, targetWord, otherWord);
    } catch (error) {
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
        if (error.name === "AbortError") {
          return "error";
        }
      }
      return "error";
    }
  },
};
