const STORAGE_KEY = "lr-correct-sound";

/** Default on when no preference is stored. */
export function isCorrectSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setCorrectSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  try {
    return new Ctx();
  } catch {
    return null;
  }
}

/** Short metallic bell/ding via Web Audio — only call after a user gesture (e.g. answer click). */
export function playCorrectAnswerSound(): void {
  if (!isCorrectSoundEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const decay = 0.18;
    const partials: { freq: number; vol: number }[] = [
      { freq: 1760, vol: 0.14 },
      { freq: 2640, vol: 0.05 },
      { freq: 3520, vol: 0.025 },
    ];
    let pending = partials.length;

    const onEnded = () => {
      pending -= 1;
      if (pending <= 0) void ctx.close();
    };

    for (const { freq, vol } of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

      osc.start(t);
      osc.stop(t + decay);
      osc.onended = onEnded;
    }
  } catch {
    void ctx.close();
  }
}

/** Short buzzer via Web Audio — only call after a user gesture (e.g. answer click). */
export function playIncorrectAnswerSound(): void {
  if (!isCorrectSoundEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    let pending = 2;

    const onPulseEnd = () => {
      pending -= 1;
      if (pending <= 0) void ctx.close();
    };

    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const start = t + i * 0.13;
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, start);
      osc.frequency.exponentialRampToValueAtTime(110, start + 0.1);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);

      osc.start(start);
      osc.stop(start + 0.11);
      osc.onended = onPulseEnd;
    }
  } catch {
    void ctx.close();
  }
}
