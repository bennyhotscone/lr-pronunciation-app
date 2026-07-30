import { describe, expect, it } from "vitest";
import {
  downmixToMono,
  measureLoudness,
  normalisePeak,
  prepareAudio,
  resampleLinear,
  TARGET_SAMPLE_RATE,
  trimSilence,
} from "@/lib/recognition/audio";

function tone(
  sampleRate: number,
  frequency: number,
  durationSec: number,
  amplitude = 0.4,
): Float32Array {
  const length = Math.round(sampleRate * durationSec);
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    samples[index] =
      Math.sin((2 * Math.PI * frequency * index) / sampleRate) * amplitude;
  }
  return samples;
}

describe("downmixToMono", () => {
  it("returns the only channel unchanged", () => {
    const mono = new Float32Array([0.1, -0.2, 0.3]);
    expect(downmixToMono([mono])).toEqual(mono);
  });

  it("averages stereo channels", () => {
    const left = new Float32Array([1, 1, 1]);
    const right = new Float32Array([-1, -1, -1]);
    expect(Array.from(downmixToMono([left, right]))).toEqual([0, 0, 0]);
  });
});

describe("resampleLinear", () => {
  it("returns the same buffer when rates match", () => {
    const input = new Float32Array([0, 0.5, 1]);
    expect(resampleLinear(input, 16_000, 16_000)).toBe(input);
  });

  it("downsamples 48 kHz mono to 16 kHz", () => {
    const input = tone(48_000, 440, 0.05);
    const output = resampleLinear(input, 48_000, TARGET_SAMPLE_RATE);
    expect(output.length).toBe(Math.round(input.length * (16_000 / 48_000)));
    expect(output.length).toBeGreaterThan(100);
    // Peak should remain in a sensible range after linear interpolation.
    const { peak } = measureLoudness(output);
    expect(peak).toBeGreaterThan(0.2);
    expect(peak).toBeLessThan(0.6);
  });

  it("upsamples 8 kHz to 16 kHz", () => {
    const input = tone(8_000, 220, 0.04);
    const output = resampleLinear(input, 8_000, 16_000);
    expect(output.length).toBe(Math.round(input.length * 2));
  });
});

describe("trimSilence + normalisePeak", () => {
  it("keeps the loud middle and drops leading silence", () => {
    // Pads must exceed the 120 ms keep-alive margin on each side.
    const silent = new Float32Array(8_000);
    const loud = tone(16_000, 500, 0.05, 0.5);
    const joined = new Float32Array(silent.length * 2 + loud.length);
    joined.set(loud, silent.length);
    const trimmed = trimSilence(joined, 16_000);
    expect(trimmed.length).toBeLessThan(joined.length);
    expect(trimmed.length).toBeGreaterThan(loud.length * 0.8);
    expect(trimmed.length).toBeLessThan(loud.length + 16_000 * 0.3);
  });

  it("boosts quiet speech toward a usable peak", () => {
    const quiet = tone(16_000, 300, 0.05, 0.05);
    const boosted = normalisePeak(quiet, 0.95, 12);
    expect(measureLoudness(boosted).peak).toBeGreaterThan(0.4);
  });
});

describe("prepareAudio", () => {
  it("produces 16 kHz mono from a synthetic stereo 44.1 kHz clip", () => {
    const left = tone(44_100, 440, 0.08, 0.35);
    const right = tone(44_100, 440, 0.08, 0.35);
    const prepared = prepareAudio([left, right], 44_100);
    expect(prepared.sampleRate).toBe(16_000);
    expect(prepared.silent).toBe(false);
    expect(prepared.samples.length).toBeGreaterThan(500);
    expect(prepared.durationMs).toBeGreaterThan(40);
  });

  it("flags near-silent buffers", () => {
    const hush = new Float32Array(16_000).map((_, index) =>
      index % 1000 === 0 ? 0.0001 : 0,
    );
    // map returns a regular array from typed arrays in some engines — rebuild.
    const samples = new Float32Array(16_000);
    const prepared = prepareAudio([samples], 16_000);
    expect(prepared.silent).toBe(true);
    expect(hush.length).toBe(16_000);
  });
});
