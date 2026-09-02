"use client";

import { useCallback, useRef, useState } from "react";
import type { PronunciationPair } from "@/data/pairs";
import { StatusLiveRegion } from "@/components/StatusLiveRegion";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { shuffleTwo } from "@/lib/pair-utils";
import {
  playCorrectAnswerSound,
  playIncorrectAnswerSound,
} from "@/lib/correct-answer-sound";

type Props = {
  pair: PronunciationPair;
  onAttempt: (opts: { pairId: string; correct: boolean }) => void;
  onContinue: () => void;
};

type Phase = "ready" | "answered";

type RoundState = {
  targetWord: string;
  choices: [string, string];
  phase: Phase;
  selected: string | null;
  feedback: string;
};

function createRound(pair: PronunciationPair): RoundState {
  const targetWord = Math.random() < 0.5 ? pair.leftWord : pair.rightWord;
  return {
    targetWord,
    choices: shuffleTwo(pair.leftWord, pair.rightWord),
    phase: "ready",
    selected: null,
    feedback: "",
  };
}

export function ListeningQuiz({ pair, onAttempt, onContinue }: Props) {
  const { speak, status, supported } = useSpeechSynthesis();
  const [round, setRound] = useState<RoundState>(() => createRound(pair));
  const speakLock = useRef(false);

  const playPrompt = useCallback(async () => {
    if (speakLock.current || round.phase === "answered") return;
    speakLock.current = true;
    setRound((prev) => ({ ...prev, feedback: "Playing a word…" }));
    await speak(round.targetWord);
    setRound((prev) => ({
      ...prev,
      feedback: "Choose the word you heard.",
    }));
    speakLock.current = false;
  }, [round.phase, round.targetWord, speak]);

  const answer = (word: string) => {
    if (round.phase === "answered" || speakLock.current) return;
    const correct = word === round.targetWord;
    const message = correct
      ? `Nice! You heard ${round.targetWord}.`
      : `Almost — the word was ${round.targetWord}.`;
    setRound((prev) => ({
      ...prev,
      selected: word,
      phase: "answered",
      feedback: message,
    }));
    if (correct) playCorrectAnswerSound();
    else playIncorrectAnswerSound();
    onAttempt({ pairId: pair.id, correct });
  };

  const correct = round.phase === "answered" && round.selected === round.targetWord;

  return (
    <div className="card space-y-4 rounded-[1.5rem] p-4 sm:p-5">
      <StatusLiveRegion message={round.feedback} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden="true">🎧</span> Listening challenge
          </h2>
          <p className="mt-1 text-sm text-muted">
            Play a hidden word, then pick what you heard. Button order is shuffled.
          </p>
        </div>
      </div>

      {!supported || status === "unsupported" ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Speech playback is unavailable in this browser. You can still practise
          with the written words on the Learn page.
        </p>
      ) : null}

      <button
        type="button"
        className="btn-primary touch-target inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          void playPrompt();
        }}
        disabled={round.phase === "answered" || status === "speaking"}
        aria-label="Play the mystery word"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20"
        >
          {status === "speaking" ? "…" : "▶"}
        </span>
        <span>{status === "speaking" ? "Playing…" : "Play mystery word"}</span>
      </button>

      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        role="group"
        aria-label="Answer choices"
      >
        {round.choices.map((word) => {
          const isSelected = round.selected === word;
          const isCorrectChoice =
            round.phase === "answered" && word === round.targetWord;
          const isWrongChoice =
            round.phase === "answered" &&
            isSelected &&
            word !== round.targetWord;
          return (
            <button
              key={`${pair.id}-${word}-${round.choices.join("-")}`}
              type="button"
              className={`touch-target rounded-2xl border-2 px-4 py-4 text-lg font-bold transition ${
                isCorrectChoice
                  ? "border-success bg-success/10 text-success"
                  : isWrongChoice
                    ? "border-danger bg-danger/10 text-danger"
                    : "border-border bg-white hover:border-accent/50"
              }`}
              onClick={() => answer(word)}
              disabled={round.phase === "answered"}
              aria-pressed={isSelected}
            >
              {word}
              {isCorrectChoice ? " ✓" : ""}
              {isWrongChoice ? " ✗" : ""}
            </button>
          );
        })}
      </div>

      {round.feedback ? (
        <p
          className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
            round.phase === "answered"
              ? correct
                ? "bg-success/10 text-success"
                : "bg-amber/25 text-foreground"
              : "bg-accent-soft text-foreground"
          }`}
          role="status"
        >
          {round.feedback}
        </p>
      ) : null}

      {round.phase === "answered" ? (
        <button
          type="button"
          className="btn-primary touch-target w-full rounded-2xl px-4 py-3 font-bold"
          onClick={onContinue}
        >
          Next challenge →
        </button>
      ) : null}
    </div>
  );
}
