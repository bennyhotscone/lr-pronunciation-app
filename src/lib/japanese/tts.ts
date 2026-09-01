/** Client-side Japanese TTS via Web Speech API. */
import type { PlayAudioDebugInfo } from "./word-helpers";

let pendingSpeakTimer: ReturnType<typeof setTimeout> | null = null;
let speakGeneration = 0;

function clearPendingSpeakTimer(): void {
  if (pendingSpeakTimer !== null) {
    clearTimeout(pendingSpeakTimer);
    pendingSpeakTimer = null;
  }
}

/** Cancel in-flight speech and any queued speak timers. */
export function cancelJapaneseSpeech(): void {
  speakGeneration += 1;
  clearPendingSpeakTimer();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function logPlayRequest(debug: PlayAudioDebugInfo): void {
  if (process.env.NODE_ENV !== "development") return;
  console.debug("[japanese-tts]", debug);
}

/**
 * Speak Japanese text. Only the latest request plays — older timers are cleared.
 */
export function speakJapanese(text: string, debug?: PlayAudioDebugInfo): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  if (debug) logPlayRequest(debug);

  cancelJapaneseSpeech();
  const generation = speakGeneration;

  pendingSpeakTimer = setTimeout(() => {
    pendingSpeakTimer = null;
    if (generation !== speakGeneration) return;

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 0.72;
    u.pitch = 1;
    const vs = window.speechSynthesis.getVoices();
    const ja = vs.find((v) => v.lang && v.lang.toLowerCase().startsWith("ja"));
    if (ja) u.voice = ja;
    window.speechSynthesis.speak(u);
  }, 80);
}

/** Play resolved word audio with debug logging. */
export function playWordAudio(finalAudio: string, debug: PlayAudioDebugInfo): void {
  speakJapanese(finalAudio, debug);
}
