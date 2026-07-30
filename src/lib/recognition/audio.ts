export const TARGET_SAMPLE_RATE = 16_000;

/** Minimum loudness before a clip is treated as silence rather than speech. */
const MIN_PEAK = 0.012;
const MIN_RMS = 0.0015;

export interface PreparedAudio {
  samples: Float32Array;
  sampleRate: number;
  durationMs: number;
  peak: number;
  rms: number;
  /** True when the clip is too quiet to be worth sending to the model. */
  silent: boolean;
}

export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];

  const length = channels.reduce(
    (longest, channel) => Math.max(longest, channel.length),
    0,
  );
  const mono = new Float32Array(length);
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      mono[index] += channel[index];
    }
  }
  for (let index = 0; index < length; index += 1) {
    mono[index] /= channels.length;
  }
  return mono;
}

export function resampleLinear(
  input: Float32Array,
  sourceRate: number,
  targetRate: number = TARGET_SAMPLE_RATE,
): Float32Array {
  if (input.length === 0) return new Float32Array(0);
  if (sourceRate === targetRate || sourceRate <= 0) return input;

  const outputLength = Math.max(
    1,
    Math.round(input.length * (targetRate / sourceRate)),
  );
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / targetRate;

  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;
    output[index] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

export function measureLoudness(samples: Float32Array): {
  peak: number;
  rms: number;
} {
  if (samples.length === 0) return { peak: 0, rms: 0 };

  let peak = 0;
  let energy = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const magnitude = Math.abs(sample);
    if (magnitude > peak) peak = magnitude;
    energy += sample * sample;
  }
  return { peak, rms: Math.sqrt(energy / samples.length) };
}

/**
 * Drops leading/trailing silence using a short-window energy gate, keeping a
 * small margin so plosives and word-initial consonants survive the trim.
 */
export function trimSilence(
  samples: Float32Array,
  sampleRate: number = TARGET_SAMPLE_RATE,
): Float32Array {
  if (samples.length === 0) return samples;

  const { peak } = measureLoudness(samples);
  if (peak === 0) return samples;

  const gate = Math.max(peak * 0.08, MIN_PEAK / 2);
  const windowSize = Math.max(1, Math.round(sampleRate * 0.01));
  const margin = Math.round(sampleRate * 0.12);

  let firstLoud = -1;
  let lastLoud = -1;
  for (let start = 0; start < samples.length; start += windowSize) {
    const end = Math.min(start + windowSize, samples.length);
    let windowPeak = 0;
    for (let index = start; index < end; index += 1) {
      windowPeak = Math.max(windowPeak, Math.abs(samples[index]));
    }
    if (windowPeak >= gate) {
      if (firstLoud === -1) firstLoud = start;
      lastLoud = end;
    }
  }

  if (firstLoud === -1) return samples;

  const from = Math.max(0, firstLoud - margin);
  const to = Math.min(samples.length, lastLoud + margin);
  return samples.slice(from, to);
}

export function normalisePeak(
  samples: Float32Array,
  targetPeak = 0.95,
  maxGain = 12,
): Float32Array {
  const { peak } = measureLoudness(samples);
  if (peak === 0) return samples;

  const gain = Math.min(targetPeak / peak, maxGain);
  if (gain <= 1.01) return samples;

  const output = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    output[index] = Math.max(-1, Math.min(1, samples[index] * gain));
  }
  return output;
}

/**
 * Full preprocessing chain shared by the provider and the tests: downmix to
 * mono, resample to 16 kHz, trim silence, peak-normalise, and report loudness.
 */
export function prepareAudio(
  channels: Float32Array[],
  sourceRate: number,
): PreparedAudio {
  const mono = downmixToMono(channels);
  const loudness = measureLoudness(mono);
  const resampled = resampleLinear(mono, sourceRate, TARGET_SAMPLE_RATE);
  const trimmed = trimSilence(resampled, TARGET_SAMPLE_RATE);
  const samples = normalisePeak(trimmed);

  return {
    samples,
    sampleRate: TARGET_SAMPLE_RATE,
    durationMs: (samples.length / TARGET_SAMPLE_RATE) * 1000,
    peak: loudness.peak,
    rms: loudness.rms,
    silent:
      samples.length === 0 ||
      loudness.peak < MIN_PEAK ||
      loudness.rms < MIN_RMS,
  };
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as Window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? scope.webkitAudioContext ?? null;
}

export function canDecodeAudio(): boolean {
  return getAudioContextConstructor() !== null;
}

function decodeArrayBuffer(
  context: AudioContext,
  buffer: ArrayBuffer,
): Promise<AudioBuffer> {
  // Safari still needs the callback form of decodeAudioData.
  return new Promise((resolve, reject) => {
    const maybePromise = context.decodeAudioData(buffer, resolve, reject);
    if (maybePromise && typeof maybePromise.then === "function") {
      maybePromise.then(resolve, reject);
    }
  });
}

/**
 * Decodes a MediaRecorder blob (webm/opus, mp4/aac, ogg…) into 16 kHz mono
 * Float32 PCM, which is the only shape the Whisper pipeline accepts.
 */
export async function decodeBlobToPcm(blob: Blob): Promise<PreparedAudio> {
  const Constructor = getAudioContextConstructor();
  if (!Constructor) {
    throw new Error("This browser cannot decode audio (no AudioContext).");
  }
  if (blob.size === 0) {
    throw new Error("The recording was empty.");
  }

  const context = new Constructor();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await decodeArrayBuffer(context, arrayBuffer);
    const channels: Float32Array[] = [];
    for (let index = 0; index < audioBuffer.numberOfChannels; index += 1) {
      channels.push(new Float32Array(audioBuffer.getChannelData(index)));
    }
    return prepareAudio(channels, audioBuffer.sampleRate);
  } finally {
    void context.close();
  }
}
