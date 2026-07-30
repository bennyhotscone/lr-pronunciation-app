"use client";

import { outcomeToLabel, type RecognitionOutcome } from "@/lib/recognition/types";

type Props = {
  outcome: RecognitionOutcome;
};

export function RecognitionResult({ outcome }: Props) {
  const label = outcomeToLabel(outcome);
  if (!label && outcome !== "listening") return null;

  const tone =
    outcome === "target"
      ? "border-success bg-success/10 text-success"
      : outcome === "other" || outcome === "error"
        ? "border-danger/40 bg-danger/10 text-danger"
        : outcome === "listening"
          ? "border-accent/30 bg-accent-soft text-accent"
          : "border-border bg-white text-foreground";

  const icon =
    outcome === "target"
      ? "✓ "
      : outcome === "other"
        ? "↔ "
        : outcome === "listening"
          ? "… "
          : outcome === "error"
            ? "! "
            : "";

  const text =
    outcome === "listening"
      ? "Listening…"
      : label || "";

  return (
    <p
      className={`rounded-2xl border-2 px-3 py-3 text-sm font-bold ${tone}`}
      role="status"
    >
      {icon}
      {text}
    </p>
  );
}
