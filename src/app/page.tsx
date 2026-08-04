"use client";

import Link from "next/link";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLocalProgress } from "@/hooks/useLocalProgress";

export default function HomePage() {
  const { progress, ready, recovered, setLanguage } = useLocalProgress();
  const hasStarted = progress.currentSequence > 1 || progress.listening.attempts > 0;

  return (
    <div className="space-y-5">
      <section className="card card-hero relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
        <div
          aria-hidden="true"
          className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-accent-2/20 blur-xl"
        />
        <div className="relative">
          <p className="chip bg-white/80 text-accent">Pronunciation trainer</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Hear it. Say it.
            <span className="mt-1 block bg-gradient-to-r from-accent via-accent-2 to-coral bg-clip-text text-transparent">
              Master L and R.
            </span>
          </h1>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
            Friendly practice for Japanese and Thai learners. Listen first, then
            speak. Your progress stays on this device — no account needed.
          </p>

          <div className="mt-5 flex items-center gap-3" aria-hidden="true">
            <div className="animate-soft-bounce rounded-2xl bg-white/80 px-3 py-2 shadow-sm">
              <span className="sound-badge sound-badge-l">L</span>
              <span className="ml-2 text-sm font-bold text-teal">tongue tip</span>
            </div>
            <div
              className="animate-soft-bounce rounded-2xl bg-white/80 px-3 py-2 shadow-sm"
              style={{ animationDelay: "0.35s" }}
            >
              <span className="sound-badge sound-badge-r">R</span>
              <span className="ml-2 text-sm font-bold text-coral">no tap</span>
            </div>
          </div>
        </div>
      </section>

      {!ready ? (
        <p className="text-sm text-muted">Loading saved preferences…</p>
      ) : (
        <>
          {recovered ? (
            <p className="rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              Saved progress looked damaged, so defaults were restored.
            </p>
          ) : null}

          <LanguageSelector value={progress.language} onChange={setLanguage} />

          <p className="card rounded-2xl px-4 py-3 text-sm leading-relaxed text-muted">
            <span className="font-bold text-foreground">Privacy: </span>
            microphone recordings stay on this device. Spoken audio is not
            uploaded. Optional on-device checking may download a free speech
            model to your browser cache, then run locally.
          </p>

          <Link
            href="/learn"
            className="btn-primary pulse-attention touch-target inline-flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-center text-base font-bold"
          >
            {hasStarted ? "Continue practising →" : "Start practising →"}
          </Link>

          <Link
            href="/english-for-mandarin-speakers"
            className="touch-target inline-flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-amber bg-gradient-to-br from-amber/30 via-white to-accent-soft px-4 py-4 text-center shadow-md shadow-amber/20 transition hover:brightness-105"
          >
            <span className="text-base font-bold text-foreground sm:text-lg">
              English for Mandarin Speakers
            </span>
            <span className="text-sm font-semibold text-muted">
              中文母语者英语课程
            </span>
          </Link>

          <Link
            href="/english-for-mandarin-speakers/mahjong"
            className="touch-target inline-flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-[#8b5a2b]/40 bg-gradient-to-br from-[#214f3c] via-[#1a4d3a] to-[#16382b] px-4 py-3.5 text-center text-[#fffaf0] shadow-md shadow-[#0e261c]/25 transition hover:brightness-110"
          >
            <span className="font-[family-name:var(--font-display)] text-base font-semibold sm:text-lg">
              Mahjong Solitaire
            </span>
            <span className="text-sm font-semibold text-[#f0e6c8]/85">
              Stacked tiles · English ↔ 中文
            </span>
          </Link>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href="/practice"
              className="btn-secondary touch-target inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold"
            >
              <span aria-hidden="true">🎯</span> Practice
            </Link>
            <Link
              href="/progress"
              className="btn-secondary touch-target inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold"
            >
              <span aria-hidden="true">⭐</span> Progress
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
