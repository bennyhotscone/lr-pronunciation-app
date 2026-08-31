/** Client-side Japanese TTS via Web Speech API (matches reference HTML). */
export function speakJapanese(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 0.72;
    u.pitch = 1;
    const vs = window.speechSynthesis.getVoices();
    const ja = vs.find((v) => v.lang && v.lang.toLowerCase().startsWith("ja"));
    if (ja) u.voice = ja;
    window.speechSynthesis.speak(u);
  }, 120);
}
