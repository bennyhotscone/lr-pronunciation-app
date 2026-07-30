"use client";

import { outcomeToLabel, type RecognitionOutcome } from "@/lib/recognition/types";

type Props = {
  outcome: RecognitionOutcome;
  statusMessage?: string;
  loadProgress?: number | null;
};

export function RecognitionResult({
  outcome,
  statusMessage,
  loadProgress,
}: Props) {
  const label = outcomeToLabel(outcome);
  if (!label && outcome !== "listening" && outcome !== "loading") return null;

  const tone =
    outcome === "target"
      ? "border-success bg-success/10 text-success"
      : outcome === "other" || outcome === "error"
        ? "border-danger/40 bg-danger/10 text-danger"
        : outcome === "listening" || outcome === "loading"
          ? "border-accent/30 bg-accent-soft text-accent"
          : "border-border bg-white text-foreground";

  const icon =
    outcome === "target"
      ? "✓ "
      : outcome === "other"
        ? "↔ "
        : outcome === "listening" || outcome === "loading"
          ? "… "
          : outcome === "error"
            ? "! "
            : "";

  const progressText =
    outcome === "loading" && loadProgress !== null && loadProgress !== undefined
      ? ` ${Math.round(loadProgress)}%`
      : "";

  const text =
    outcome === "listening"
      ? statusMessage || "Checking your recording…"
      : outcome === "loading"
        ? `${statusMessage || "Loading the on-device model… first time only"}${progressText}`
        : label || "";

  return (
    <p
      className={`rounded-2xl border-2 px-3 py-3 text-sm font-bold ${tone}`}
      role="status"
      data-recognition-outcome={outcome}
    >
      {icon}
      {text}
      {statusMessage &&
      outcome !== "listening" &&
      outcome !== "loading" &&
      statusMessage !== label ? (
        <span className="mt-1 block text-xs font-medium opacity-80">
          {statusMessage}
        </span>
      ) : null}
    </p>
  );
}
