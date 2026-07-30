export type SpeakStatus = "idle" | "speaking" | "unsupported" | "error";

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function cancelSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}

export function speakWord(word: string): Promise<SpeakStatus> {
  if (!isSpeechSynthesisSupported()) {
    return Promise.resolve("unsupported");
  }

  return new Promise((resolve) => {
    try {
      cancelSpeech();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = 0.9;

      utterance.onend = () => resolve("idle");
      utterance.onerror = () => resolve("error");

      window.speechSynthesis.speak(utterance);
    } catch {
      resolve("error");
    }
  });
}
