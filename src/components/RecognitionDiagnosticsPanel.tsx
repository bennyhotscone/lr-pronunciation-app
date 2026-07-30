"use client";

import type { RecognitionDiagnostics } from "@/lib/recognition/types";

type Props = {
  diagnostics: RecognitionDiagnostics;
};

export function RecognitionDiagnosticsPanel({ diagnostics }: Props) {
  return (
    <details className="rounded-2xl border border-dashed border-border bg-white/70 px-3 py-2 text-xs text-muted">
      <summary className="cursor-pointer select-none font-bold text-foreground">
        Technical details
      </summary>
      <dl
        className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1"
        data-testid="recognition-diagnostics"
      >
        <dt>Model loaded</dt>
        <dd data-diag="model-loaded">
          {diagnostics.modelLoaded ? "yes" : "no"}
        </dd>
        <dt>Model</dt>
        <dd data-diag="model-id">{diagnostics.modelId || "—"}</dd>
        <dt>Backend</dt>
        <dd data-diag="backend">{diagnostics.backend}</dd>
        <dt>Last transcript</dt>
        <dd data-diag="last-transcript">
          {diagnostics.lastTranscript
            ? `“${diagnostics.lastTranscript.trim()}”`
            : "—"}
        </dd>
        <dt>Matched outcome</dt>
        <dd data-diag="last-outcome">{diagnostics.lastOutcome || "—"}</dd>
        <dt>Status</dt>
        <dd data-diag="status">{diagnostics.statusMessage || "—"}</dd>
        {diagnostics.lastError ? (
          <>
            <dt>Last error</dt>
            <dd data-diag="last-error" className="text-danger">
              {diagnostics.lastError}
            </dd>
          </>
        ) : null}
      </dl>
      <p className="mt-2 text-[11px] leading-snug">
        This is a word-level on-device check, not phoneme scoring. Close L/R
        pairs can still be misheard. Audio never leaves this device.
      </p>
    </details>
  );
}
