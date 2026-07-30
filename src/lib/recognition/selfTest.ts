import { matchPairWords } from "@/lib/recognition/normalizeTranscript";
import { onDeviceWhisperProvider } from "@/lib/recognition/onDeviceWhisperProvider";
import { TARGET_SAMPLE_RATE } from "@/lib/recognition/audio";

export type SelfTestResult = {
  ok: boolean;
  modelLoaded: boolean;
  backend: string;
  modelId: string;
  transcript: string;
  matcher: {
    writeToRight: ReturnType<typeof matchPairWords>;
    liteToLight: ReturnType<typeof matchPairWords>;
    rightPunct: ReturnType<typeof matchPairWords>;
    lightSpaces: ReturnType<typeof matchPairWords>;
    empty: ReturnType<typeof matchPairWords>;
    hello: ReturnType<typeof matchPairWords>;
  };
  inferenceError: string | null;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
};

/**
 * Deterministic browser self-test used by CDP verification and the Technical
 * details panel. Generates a short synthetic tone (not speech) so inference
 * can be exercised without a microphone. Matching is verified with fixed
 * transcript strings.
 */
export async function runRecognitionSelfTest(): Promise<SelfTestResult> {
  const matcher = {
    writeToRight: matchPairWords("write", "right", "light"),
    liteToLight: matchPairWords("lite", "light", "right"),
    rightPunct: matchPairWords("Right.", "right", "light"),
    lightSpaces: matchPairWords(" light ", "light", "right"),
    empty: matchPairWords("", "light", "right"),
    hello: matchPairWords("hello", "light", "right"),
  };

  const matcherOk =
    matcher.writeToRight === "target" &&
    matcher.liteToLight === "target" &&
    matcher.rightPunct === "target" &&
    matcher.lightSpaces === "target" &&
    matcher.empty === "unclear" &&
    matcher.hello === "unclear";

  let transcript = "";
  let inferenceError: string | null = null;
  let modelLoaded = false;
  let backend = "unknown";
  let modelId = "";

  try {
    if (onDeviceWhisperProvider.preload) {
      const loaded = await onDeviceWhisperProvider.preload();
      modelLoaded = true;
      backend = loaded.backend;
      modelId = loaded.modelId;
    }

    // 0.6s of 440 Hz tone at 16 kHz — not speech, but proves the pipeline runs.
    const samples = new Float32Array(Math.round(TARGET_SAMPLE_RATE * 0.6));
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] =
        Math.sin((2 * Math.PI * 440 * index) / TARGET_SAMPLE_RATE) * 0.35;
    }

    const outcome = await onDeviceWhisperProvider.recognize({
      targetWord: "light",
      otherWord: "right",
      audioSamples: samples,
    });

    const diagnostics = onDeviceWhisperProvider.getDiagnostics?.();
    transcript = diagnostics?.lastTranscript ?? "";
    modelLoaded = diagnostics?.modelLoaded ?? modelLoaded;
    backend = diagnostics?.backend ?? backend;
    modelId = diagnostics?.modelId ?? modelId;

    // Tone audio should not crash; outcome may be unclear — that is fine.
    void outcome;
  } catch (error) {
    inferenceError = error instanceof Error ? error.message : String(error);
  }

  return {
    ok: matcherOk && modelLoaded && !inferenceError,
    modelLoaded,
    backend,
    modelId,
    transcript,
    matcher,
    inferenceError,
    crossOriginIsolated:
      typeof crossOriginIsolated !== "undefined" && crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
  };
}

export function installRecognitionSelfTestGlobal() {
  if (typeof window === "undefined") return;
  (
    window as Window & {
      __lrRecognitionSelfTest?: typeof runRecognitionSelfTest;
    }
  ).__lrRecognitionSelfTest = runRecognitionSelfTest;
}
