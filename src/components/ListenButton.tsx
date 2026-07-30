"use client";

type Props = {
  word: string;
  onListen: (word: string) => void;
  disabled?: boolean;
  speaking?: boolean;
  tone?: "l" | "r" | "neutral";
};

export function ListenButton({
  word,
  onListen,
  disabled,
  speaking,
  tone = "neutral",
}: Props) {
  const toneClass =
    tone === "l"
      ? "from-teal to-teal/80 shadow-teal/25"
      : tone === "r"
        ? "from-coral to-accent-2 shadow-coral/25"
        : "from-accent to-accent-2 shadow-accent/25";

  return (
    <button
      type="button"
      className={`touch-target inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br ${toneClass} px-4 py-3.5 text-base font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50`}
      onClick={() => onListen(word)}
      disabled={disabled}
      aria-label={`Listen to ${word}`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm ${speaking ? "animate-pulse" : ""}`}
      >
        {speaking ? "…" : "▶"}
      </span>
      <span>Listen: {word}</span>
    </button>
  );
}
