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

/** Short bell via Web Audio — only call after a user gesture (e.g. answer click). */
export function playCorrectAnswerSound(): void {
  if (typeof window === "undefined" || !isCorrectSoundEnabled()) return;

  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.start(t);
    osc.stop(t + 0.22);
    osc.onended = () => void ctx.close();
  } catch {
    /* Audio unavailable — fail silently */
  }
}
