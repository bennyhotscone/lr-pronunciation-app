"use client";

import { useMemo } from "react";
import { ListenButton } from "@/components/ListenButton";
import { PairCard } from "@/components/PairCard";
import { StatusLiveRegion } from "@/components/StatusLiveRegion";
import { ARTICULATION_GUIDANCE, getLanguageTip } from "@/data/guidance";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { getPairBySequence, PAIR_COUNT } from "@/lib/pair-utils";

export default function LearnPage() {
  const { progress, ready, setCurrentSequence } = useLocalProgress();
  const { speak, status, supported } = useSpeechSynthesis();

  const pair = useMemo(
    () => getPairBySequence(progress.currentSequence),
    [progress.currentSequence],
  );

  if (!ready) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (!pair) {
    return <p className="text-sm text-danger">Could not load this pair.</p>;
  }

  const tip = getLanguageTip(progress.language, pair.category);
  const live =
    status === "speaking"
      ? "Playing word…"
      : status === "unsupported"
        ? "Speech playback unavailable."
        : status === "error"
          ? "Could not play audio."
          : "";

  return (
    <div className="space-y-4">
      <StatusLiveRegion message={live} />
      <PairCard pair={pair}>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ListenButton
            word={pair.leftWord}
            tone="l"
            onListen={(word) => {
              void speak(word);
            }}
            disabled={!supported || status === "speaking"}
            speaking={status === "speaking"}
          />
          <ListenButton
            word={pair.rightWord}
            tone="r"
            onListen={(word) => {
              void speak(word);
            }}
            disabled={!supported || status === "speaking"}
            speaking={status === "speaking"}
          />
        </div>
      </PairCard>

      {!supported || status === "unsupported" ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Browser speech synthesis is unavailable. You can still read the pair
          and articulation tips.
        </p>
      ) : null}

      {status === "error" ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Could not play that word. Try again.
        </p>
      ) : null}

      <section className="card space-y-3 rounded-[1.5rem] p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden="true">👄</span> How to shape the sounds
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <p className="rounded-2xl bg-teal/10 px-3 py-3 text-sm leading-relaxed text-muted">
            <span className="mb-1 inline-flex items-center gap-2 font-bold text-teal">
              <span className="sound-badge sound-badge-l !h-7 !w-7 !text-sm">L</span>
              /l/
            </span>
            <br />
            {ARTICULATION_GUIDANCE.l}
          </p>
          <p className="rounded-2xl bg-coral/10 px-3 py-3 text-sm leading-relaxed text-muted">
            <span className="mb-1 inline-flex items-center gap-2 font-bold text-coral">
              <span className="sound-badge sound-badge-r !h-7 !w-7 !text-sm">R</span>
              /r/
            </span>
            <br />
            {ARTICULATION_GUIDANCE.r}
          </p>
        </div>
        <p className="rounded-2xl bg-gradient-to-r from-accent-soft to-amber/20 px-3 py-3 text-sm leading-relaxed">
          <span className="font-bold text-accent">Tip for you: </span>
          {tip}
        </p>
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary touch-target flex-1 rounded-2xl px-4 py-3 font-bold disabled:opacity-40"
          disabled={progress.currentSequence <= 1}
          onClick={() => setCurrentSequence(progress.currentSequence - 1)}
        >
          ← Previous
        </button>
        <button
          type="button"
          className="btn-primary touch-target flex-1 rounded-2xl px-4 py-3 font-bold disabled:opacity-40"
          disabled={progress.currentSequence >= PAIR_COUNT}
          onClick={() => setCurrentSequence(progress.currentSequence + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
