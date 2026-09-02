import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isCorrectSoundEnabled,
  playCorrectAnswerSound,
  playIncorrectAnswerSound,
  setCorrectSoundEnabled,
} from "./correct-answer-sound";

describe("quiz answer sounds", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults sound on when no preference stored", () => {
    expect(isCorrectSoundEnabled()).toBe(true);
  });

  it("respects mute preference", () => {
    setCorrectSoundEnabled(false);
    expect(isCorrectSoundEnabled()).toBe(false);
    setCorrectSoundEnabled(true);
    expect(isCorrectSoundEnabled()).toBe(true);
  });

  it("plays without throwing when AudioContext exists", () => {
    const close = vi.fn();
    const osc = {
      type: "sine",
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    };
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
    const ctx = {
      currentTime: 0,
      createOscillator: vi.fn(() => ({ ...osc })),
      createGain: vi.fn(() => ({ ...gain })),
      destination: {},
      close,
    };
    vi.stubGlobal("AudioContext", vi.fn(() => ctx));

    expect(() => playCorrectAnswerSound()).not.toThrow();
    expect(() => playIncorrectAnswerSound()).not.toThrow();
  });
});
