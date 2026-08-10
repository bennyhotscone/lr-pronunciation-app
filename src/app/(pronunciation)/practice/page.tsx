"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListeningQuiz } from "@/components/ListeningQuiz";
import { PairCard } from "@/components/PairCard";
import { RecognitionDiagnosticsPanel } from "@/components/RecognitionDiagnosticsPanel";
import { RecognitionResult } from "@/components/RecognitionResult";
import { Recorder } from "@/components/Recorder";
import { StatusLiveRegion } from "@/components/StatusLiveRegion";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { getOtherWord, getPairBySequence, PAIR_COUNT } from "@/lib/pair-utils";
import { installRecognitionSelfTestGlobal } from "@/lib/recognition/selfTest";
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
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const autoCheckTokenRef = useRef(0);
  const warmedRef = useRef(false);

  const pair = useMemo(
    () => getPairBySequence(progress.currentSequence),
    [progress.currentSequence],
  );

  const { supported: recognitionSupported, preload: preloadRecognition } =
    recognition;

  useEffect(() => {
    installRecognitionSelfTestGlobal();
  }, []);

  // Warm the model once the student opens Speaking so the first check is faster.
  useEffect(() => {
    if (mode !== "speaking" || !recognitionSupported || warmedRef.current) {
      return;
    }
    warmedRef.current = true;
    void preloadRecognition();
  }, [mode, recognitionSupported, preloadRecognition]);

  const runCheck = useCallback(
    async (blob: Blob, pairId: string, targetWord: string, otherWord: string) => {
      setMicBusy("recognize");
      try {
        const result = await recognition.recognize({
          targetWord,
          otherWord,
          audioBlob: blob,
        });
        if (result === "other") {
          recordRecognitionConfusion(pairId);
        }
        return result;
      } finally {
        setMicBusy(null);
      }
    },
    [recognition, recordRecognitionConfusion],
  );

  if (!ready) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (!pair) {
    return <p className="text-sm text-danger">Could not load this pair.</p>;
  }

  const targetWord = targetSide === "left" ? pair.leftWord : pair.rightWord;
  const otherWord = getOtherWord(pair, targetWord);
  const liveRecognition =
    recognition.statusMessage || outcomeToLabel(recognition.outcome);

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
              onCleared={() => {
                autoCheckTokenRef.current += 1;
                setRecordingBlob(null);
                recognition.reset();
              }}
              onRecorded={(blob) => {
                recordSpeakingAttempt();
                setRecordingBlob(blob);
                const token = ++autoCheckTokenRef.current;
                void runCheck(blob, pair.id, targetWord, otherWord).then(() => {
                  // Ignore stale auto-checks if the student cleared / re-recorded.
                  if (token !== autoCheckTokenRef.current) return;
                });
              }}
            />
          </div>

          <section className="card space-y-3 rounded-[1.5rem] border-dashed p-4 sm:p-5">
            <div>
              <p className="chip bg-amber/30 text-foreground">Experimental</p>
              <h2 className="mt-2 text-lg font-bold">On-device AI word check</h2>
              <p className="mt-1 text-sm text-muted">
                After you record, the same clip is checked automatically on this
                device. Nothing is uploaded. The first check downloads a small
                speech model and may take longer.
              </p>
              <p className="mt-2 text-xs text-muted">
                This is a forced choice between the two pair words — not
                phoneme-level pronunciation scoring. Close L/R pairs and strong
                accents can still be misheard.
              </p>
            </div>

            {!recognition.supported ? (
              <p className="rounded-2xl bg-accent-soft/70 px-3 py-2 text-sm">
                On-device recognition needs a modern browser with microphone
                access, AudioContext, and Web Workers.
              </p>
            ) : (
              <button
                type="button"
                className="btn-secondary touch-target w-full rounded-2xl px-4 py-3 font-bold disabled:opacity-50"
                disabled={
                  !recordingBlob ||
                  micBusy === "record" ||
                  recognition.isBusy
                }
                onClick={() => {
                  if (!recordingBlob) return;
                  void runCheck(
                    recordingBlob,
                    pair.id,
                    targetWord,
                    otherWord,
                  );
                }}
              >
                {recognition.isBusy
                  ? recognition.outcome === "loading"
                    ? "Loading on-device model…"
                    : "Checking recording…"
                  : recordingBlob
                    ? "Re-check this recording"
                    : "Record first to check"}
              </button>
            )}

            <RecognitionResult
              outcome={recognition.outcome}
              statusMessage={recognition.statusMessage}
              loadProgress={recognition.loadProgress}
            />

            <RecognitionDiagnosticsPanel
              diagnostics={recognition.diagnostics}
            />
          </section>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary touch-target flex-1 rounded-2xl px-4 py-3 font-bold disabled:opacity-40"
              disabled={progress.currentSequence <= 1}
              onClick={() => {
                recognition.reset();
                setRecordingBlob(null);
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
                setRecordingBlob(null);
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
