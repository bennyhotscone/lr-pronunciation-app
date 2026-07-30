"use client";

import { useMemo, useState } from "react";
import { ListeningQuiz } from "@/components/ListeningQuiz";
import { PairCard } from "@/components/PairCard";
import { RecognitionResult } from "@/components/RecognitionResult";
import { Recorder } from "@/components/Recorder";
import { StatusLiveRegion } from "@/components/StatusLiveRegion";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { getOtherWord, getPairBySequence, PAIR_COUNT } from "@/lib/pair-utils";
import { outcomeToLabel } from "@/lib/recognition/types";

type Mode = "listening" | "speaking";
type MicBusy = "record" | "recognize" | null;

export default function PracticePage() {
  const {
    progress,
    ready,
    setCurrentSequence,
    recordListeningAttempt,
    recordSpeakingAttempt,
    recordRecognitionConfusion,
  } = useLocalProgress();
  const recognition = useSpeechRecognition();
  const [mode, setMode] = useState<Mode>("listening");
  const [targetSide, setTargetSide] = useState<"left" | "right">("left");
  const [micBusy, setMicBusy] = useState<MicBusy>(null);
  const [listeningRound, setListeningRound] = useState(0);

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

  const targetWord = targetSide === "left" ? pair.leftWord : pair.rightWord;
  const otherWord = getOtherWord(pair, targetWord);
  const liveRecognition = outcomeToLabel(recognition.outcome);

  return (
    <div className="space-y-4">
      <StatusLiveRegion message={liveRecognition} />

      <div
        className="card grid grid-cols-2 gap-1.5 rounded-[1.5rem] p-2"
        role="tablist"
        aria-label="Practice mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "listening"}
          className={`touch-target rounded-2xl px-3 py-3 text-sm font-bold transition ${
            mode === "listening"
              ? "bg-gradient-to-br from-accent to-accent-2 text-white shadow-md"
              : "bg-accent-soft/60 text-foreground"
          }`}
          onClick={() => {
            recognition.reset();
            setMode("listening");
          }}
        >
          <span aria-hidden="true">🎧 </span>Listening
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "speaking"}
          className={`touch-target rounded-2xl px-3 py-3 text-sm font-bold transition ${
            mode === "speaking"
              ? "bg-gradient-to-br from-coral to-accent-2 text-white shadow-md"
              : "bg-accent-soft/60 text-foreground"
          }`}
          onClick={() => setMode("speaking")}
        >
          <span aria-hidden="true">🎙️ </span>Speaking
        </button>
      </div>

      <PairCard pair={pair} />

      {mode === "listening" ? (
        <ListeningQuiz
          key={`${pair.id}-${listeningRound}`}
          pair={pair}
          onAttempt={recordListeningAttempt}
          onContinue={() => {
            if (progress.currentSequence < PAIR_COUNT) {
              setCurrentSequence(progress.currentSequence + 1);
            }
            setListeningRound((value) => value + 1);
          }}
        />
      ) : (
        <div className="space-y-4">
          <section className="card rounded-[1.5rem] p-4 sm:p-5">
            <h2 className="text-lg font-bold">Say this word</h2>
            <p className="mt-3 text-center font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-accent">
              {targetWord}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`touch-target rounded-2xl border-2 px-3 py-3 text-sm font-bold ${
                  targetSide === "left"
                    ? "border-teal bg-teal/10 text-teal"
                    : "border-border bg-white"
                }`}
                onClick={() => {
                  recognition.reset();
                  setTargetSide("left");
                }}
              >
                Practise {pair.leftWord}
              </button>
              <button
                type="button"
                className={`touch-target rounded-2xl border-2 px-3 py-3 text-sm font-bold ${
                  targetSide === "right"
                    ? "border-coral bg-coral/10 text-coral"
                    : "border-border bg-white"
                }`}
                onClick={() => {
                  recognition.reset();
                  setTargetSide("right");
                }}
              >
                Practise {pair.rightWord}
              </button>
            </div>
          </section>

          <div className="card rounded-[1.5rem] p-4 sm:p-5">
            <Recorder
              disabled={micBusy === "recognize"}
              onBusyChange={(busy) => setMicBusy(busy ? "record" : null)}
              onRecorded={recordSpeakingAttempt}
            />
          </div>

          <section className="card space-y-3 rounded-[1.5rem] border-dashed p-4 sm:p-5">
            <div>
              <p className="chip bg-amber/30 text-foreground">Experimental</p>
              <h2 className="mt-2 text-lg font-bold">On-device AI word check</h2>
              <p className="mt-1 text-sm text-muted">
                A small speech model runs in your browser and compares its
                transcript with this word pair. Audio is not uploaded. The
                first check downloads the model and may take longer.
              </p>
              <p className="mt-2 text-xs text-muted">
                This is not phoneme-level pronunciation scoring and can still
                mishear close L/R words or accents.
              </p>
            </div>

            {!recognition.supported ? (
              <p className="rounded-2xl bg-accent-soft/70 px-3 py-2 text-sm">
                On-device recognition needs a modern browser with microphone
                access and Web Workers.
              </p>
            ) : (
              <button
                type="button"
                className="btn-secondary touch-target w-full rounded-2xl px-4 py-3 font-bold disabled:opacity-50"
                disabled={micBusy === "record" || recognition.isListening}
                onClick={() => {
                  setMicBusy("recognize");
                  void recognition
                    .recognize({ targetWord, otherWord })
                    .then((result) => {
                      if (result === "other") {
                        recordRecognitionConfusion(pair.id);
                      }
                    })
                    .finally(() => setMicBusy(null));
                }}
              >
                {recognition.isListening
                  ? "Listening / checking…"
                  : "Check with on-device AI"}
              </button>
            )}

            <RecognitionResult outcome={recognition.outcome} />
          </section>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary touch-target flex-1 rounded-2xl px-4 py-3 font-bold disabled:opacity-40"
              disabled={progress.currentSequence <= 1}
              onClick={() => {
                recognition.reset();
                setCurrentSequence(progress.currentSequence - 1);
              }}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn-primary touch-target flex-1 rounded-2xl px-4 py-3 font-bold disabled:opacity-40"
              disabled={progress.currentSequence >= PAIR_COUNT}
              onClick={() => {
                recognition.reset();
                setCurrentSequence(progress.currentSequence + 1);
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
