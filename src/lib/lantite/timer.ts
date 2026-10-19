import { PRACTICE_LIMIT_MS } from "@/lib/lantite/labels";
import type { QuestionCount, TimerState } from "@/lib/lantite/types";

export function freshTimer(now: number): TimerState {
  return { elapsedMs: 0, running: true, lastResumedAt: now };
}

export function elapsedNow(timer: TimerState, now: number): number {
  const extra =
    timer.running && timer.lastResumedAt != null ? Math.max(0, now - timer.lastResumedAt) : 0;
  return timer.elapsedMs + extra;
}

export function freezeTimer(timer: TimerState, now: number): TimerState {
  if (!timer.running || timer.lastResumedAt == null) return timer;
  return {
    elapsedMs: timer.elapsedMs + Math.max(0, now - timer.lastResumedAt),
    running: true,
    lastResumedAt: now,
  };
}

export function stopTimer(timer: TimerState, now: number): TimerState {
  const frozen = freezeTimer(timer, now);
  return { elapsedMs: frozen.elapsedMs, running: false, lastResumedAt: null };
}

export function limitMs(count: QuestionCount): number {
  return PRACTICE_LIMIT_MS[count];
}

/** Allowance for the number of questions actually drawn. Standard lengths use the published practice times. */
export function limitForLength(questionCount: number): number {
  if (questionCount === 10 || questionCount === 20 || questionCount === 32 || questionCount === 65) {
    return PRACTICE_LIMIT_MS[questionCount];
  }
  return Math.round((PRACTICE_LIMIT_MS[65] / 65) * Math.max(1, questionCount));
}

export function remainingMs(timer: TimerState, questionCount: number, now: number): number {
  return limitForLength(questionCount) - elapsedNow(timer, now);
}
