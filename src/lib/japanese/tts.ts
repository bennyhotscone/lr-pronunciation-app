/** Client-side Japanese TTS via Web Speech API. */
import type { PlayAudioDebugInfo } from "./word-helpers";

let pendingSpeakTimer: ReturnType<typeof setTimeout> | null = null;
let speakGeneration = 0;
let pendingUtteranceText = "";

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

function pickJapaneseVoice(): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis.getVoices().filter(
    (v) => v.lang && v.lang.toLowerCase().startsWith("ja"),
  );
  if (vs.length === 0) return undefined;

  const preferred = [
    /google.*日本語/i,
    /microsoft.*haruka/i,
    /microsoft.*ayumi/i,
    /microsoft.*ichiro/i,
    /kyoko/i,
    /otoya/i,
  ];
  for (const pattern of preferred) {
    const match = vs.find((v) => pattern.test(v.name));
    if (match) return match;
  }
  return vs[0];
}

function utterNow(text: string, generation: number): void {
  if (generation !== speakGeneration) return;

  // Chrome/Electron can leave speechSynthesis paused until resumed.
  window.speechSynthesis.resume();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = 0.72;
  u.pitch = 1;

  const ja = pickJapaneseVoice();
  if (ja) u.voice = ja;

  window.speechSynthesis.speak(u);
}

function scheduleUtterance(text: string, generation: number): void {
  const vs = window.speechSynthesis.getVoices();
  if (vs.length > 0) {
    utterNow(text, generation);
    return;
  }

  let spoke = false;
  const trySpeak = () => {
    if (spoke || generation !== speakGeneration) return;
    spoke = true;
    window.speechSynthesis.removeEventListener("voiceschanged", trySpeak);
    utterNow(text, generation);
  };

  window.speechSynthesis.addEventListener("voiceschanged", trySpeak);
  window.setTimeout(() => {
    if (!spoke) trySpeak();
  }, 200);
}

/**
 * Speak Japanese text. Only the latest request plays - older timers are cleared.
 */
export function speakJapanese(text: string, debug?: PlayAudioDebugInfo): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const utteranceText = text.trim();
  if (!utteranceText) return;

  if (debug) logPlayRequest(debug);

  cancelJapaneseSpeech();
  const generation = speakGeneration;
  pendingUtteranceText = utteranceText;

  pendingSpeakTimer = setTimeout(() => {
    pendingSpeakTimer = null;
    if (generation !== speakGeneration) return;
    scheduleUtterance(pendingUtteranceText, generation);
  }, 80);
}

/** Play resolved word audio with debug logging. */
export function playWordAudio(finalAudio: string, debug: PlayAudioDebugInfo): void {
  speakJapanese(finalAudio, debug);
}

function utterNowSlow(text: string, generation: number, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (generation !== speakGeneration || typeof window === "undefined") {
      resolve();
      return;
    }

    window.speechSynthesis.resume();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = rate;
    u.pitch = 1;

    const ja = pickJapaneseVoice();
    if (ja) u.voice = ja;

    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/** Speak each word slowly with pauses - for beginner vocab drills. */
export function speakJapaneseWordByWord(
  words: string[],
  options?: { pauseMs?: number; rate?: number },
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const tokens = words.map((w) => w.trim()).filter(Boolean);
  if (!tokens.length) return;

  cancelJapaneseSpeech();
  const generation = speakGeneration;
  const pauseMs = options?.pauseMs ?? 900;
  const rate = options?.rate ?? 0.52;

  void (async () => {
    for (const token of tokens) {
      if (generation !== speakGeneration) return;
      await utterNowSlow(token, generation, rate);
      if (generation !== speakGeneration) return;
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  })();
}
