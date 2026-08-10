"use client";

import Link from "next/link";
import { ProgressSummary } from "@/components/ProgressSummary";
import { useLocalProgress } from "@/hooks/useLocalProgress";

export default function ProgressPage() {
  const { progress, ready, resetProgress } = useLocalProgress();

  if (!ready) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <section className="card card-hero rounded-[1.5rem] p-5">
        <p className="chip bg-white/80 text-accent">Your streak board</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Progress
        </h1>
        <p className="mt-2 text-sm text-muted">
          Stored only in this browser&apos;s localStorage. No account, no cloud
          sync.
        </p>
      </section>

      <ProgressSummary progress={progress} onReset={resetProgress} />

      <Link
        href="/learn"
        className="btn-primary touch-target inline-flex w-full items-center justify-center rounded-2xl px-4 py-3.5 font-bold"
      >
        Resume at pair {progress.currentSequence} →
      </Link>
    </div>
  );
}
