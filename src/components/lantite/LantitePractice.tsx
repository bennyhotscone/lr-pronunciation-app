"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressPanel } from "@/components/lantite/ProgressPanel";
import { PrintKey, PrintReport, PrintTest } from "@/components/lantite/PrintSheets";
import { ResultsView, ReviewSession } from "@/components/lantite/ResultsView";
import { SetupPanel, type SetupChoice } from "@/components/lantite/SetupPanel";
import { SittingView } from "@/components/lantite/SittingView";
import { BANK_VERSION } from "@/lib/lantite/bank";
import { resultsToCsv } from "@/lib/lantite/export";
import { generateTest } from "@/lib/lantite/generate";
import { gradeAttempt } from "@/lib/lantite/grade";
import { DATA_NOTICE } from "@/lib/lantite/labels";
import { randomSeed } from "@/lib/lantite/random";
import { clearStored, emptyStore, readStored, writeStored } from "@/lib/lantite/storage";
import { freshTimer, freezeTimer, remainingMs, stopTimer } from "@/lib/lantite/timer";
import {
  HISTORY_LIMIT,
  type CompletedAttempt,
  type InProgressAttempt,
  type LantiteStore,
} from "@/lib/lantite/types";

type PrintJob =
  | { mode: "test"; questionIds: string[] }
  | { mode: "key"; questionIds: string[] }
  | { mode: "report"; attempt: CompletedAttempt };

function completeStore(store: LantiteStore, timedOut: boolean, now: number): LantiteStore {
  const attempt = store.inProgress;
  if (!attempt) return store;
  const completed: CompletedAttempt = {
    id: attempt.id,
    config: attempt.config,
    questionIds: attempt.questionIds,
    answers: attempt.answers,
    flagged: attempt.flagged,
    startedAt: attempt.startedAt,
    completedAt: now,
    elapsedMs: stopTimer(attempt.timer, now).elapsedMs,
    timedOut,
    bankVersion: attempt.bankVersion,
  };
  return {
    ...store,
    inProgress: null,
    history: [...store.history, completed].slice(-HISTORY_LIMIT),
    ui: { view: "results", activeAttemptId: completed.id, reviewIndex: 0 },
  };
}

export function LantitePractice() {
  const [store, setStore] = useState<LantiteStore | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const storeRef = useRef<LantiteStore | null>(null);
  const submitting = useRef(false);

  function persist(next: LantiteStore) {
    storeRef.current = next;
    setStore(next);
    const saved = writeStored(window.localStorage, next);
    if (!saved.ok) setNote(saved.message);
  }

  function update(recipe: (current: LantiteStore) => LantiteStore) {
    const current = storeRef.current;
    if (!current) return;
    persist(recipe(current));
  }

  function submit(timedOut: boolean) {
    const current = storeRef.current;
    if (!current?.inProgress || submitting.current) return;
    const unanswered = current.inProgress.questionIds.filter(
      (id) => typeof current.inProgress?.answers[id] !== "number",
    ).length;
    if (!timedOut && unanswered > 0) {
      const proceed = window.confirm(
        `You have ${unanswered} unanswered ${unanswered === 1 ? "question" : "questions"}. Submit anyway? Unanswered questions are marked incorrect.`,
      );
      if (!proceed) return;
    }
    submitting.current = true;
    persist(completeStore(current, timedOut, Date.now()));
    submitting.current = false;
  }

  useEffect(() => {
    const loaded = readStored(window.localStorage);
    let next = loaded.store;
    if (next.inProgress?.config.timed) {
      const left = remainingMs(next.inProgress.timer, next.inProgress.questionIds.length, Date.now());
      if (left <= 0) next = completeStore(next, true, Date.now());
    }
    storeRef.current = next;
    setStore(next);
    if (next !== loaded.store) writeStored(window.localStorage, next);
    if (loaded.recovered) {
      setNote("Saved practice could not be read, so a fresh copy was started on this device.");
    } else if (loaded.migrated) {
      setNote("Saved practice was brought into the current storage format.");
    }
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const current = storeRef.current;
      const attempt = current?.inProgress;
      if (!attempt?.timer.running) return;
      const stamp = Date.now();
      setNow(stamp);
      if (attempt.config.timed && remainingMs(attempt.timer, attempt.questionIds.length, stamp) <= 0) {
        submit(true);
      }
    }, 1000);
    const flush = window.setInterval(() => {
      update((current) => {
        if (!current.inProgress?.timer.running) return current;
        return {
          ...current,
          inProgress: {
            ...current.inProgress,
            timer: freezeTimer(current.inProgress.timer, Date.now()),
          },
        };
      });
    }, 5000);
    const onHide = () => {
      update((current) => {
        if (!current.inProgress?.timer.running) return current;
        return {
          ...current,
          inProgress: {
            ...current.inProgress,
            timer: freezeTimer(current.inProgress.timer, Date.now()),
          },
        };
      });
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(flush);
      window.removeEventListener("pagehide", onHide);
    };
    // submit and update read the latest store through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!printJob) return;
    const timer = window.setTimeout(() => window.print(), 60);
    const done = () => setPrintJob(null);
    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [printJob]);

  if (!store) {
    return (
      <p className="lantite-app" role="status">
        Loading saved practice…
      </p>
    );
  }

  const active =
    store.history.find((attempt) => attempt.id === store.ui.activeAttemptId) ?? null;

  function start(choice: SetupChoice) {
    if (storeRef.current?.inProgress) {
      const discard = window.confirm("Starting a new test discards the one still in progress. Continue?");
      if (!discard) return;
    }
    const seed = randomSeed();
    const generated = generateTest({ ...choice, seed });
    if (generated.questionIds.length === 0) {
      setNote("No questions in the bank matched that choice.");
      return;
    }
    const stamp = Date.now();
    const attempt: InProgressAttempt = {
      id: `a-${stamp.toString(36)}-${seed.toString(36)}`,
      config: { ...choice, seed },
      questionIds: generated.questionIds,
      answers: {},
      flagged: [],
      currentIndex: 0,
      startedAt: stamp,
      timer: freshTimer(stamp),
      bankVersion: BANK_VERSION,
    };
    persist({
      ...(storeRef.current ?? emptyStore()),
      inProgress: attempt,
      ui: { view: "sit", activeAttemptId: null, reviewIndex: 0 },
    });
    if (generated.shortfall > 0) {
      setNote(
        `This test has ${generated.questionIds.length} questions. The bank has ${generated.available} matching items, so it cannot reach ${generated.requested} without repeating questions.`,
      );
    }
  }

  function currentIds(): string[] | null {
    const current = storeRef.current;
    if (current?.inProgress) return current.inProgress.questionIds;
    if (active) return active.questionIds;
    return null;
  }

  function printTest() {
    const ids = currentIds();
    if (!ids) {
      setNote("Start a test, or open a completed attempt, before printing.");
      return;
    }
    setPrintJob({ mode: "test", questionIds: ids });
  }

  function printKey() {
    const ids = currentIds();
    if (!ids) {
      setNote("Start a test, or open a completed attempt, before printing an answer key.");
      return;
    }
    if (storeRef.current?.inProgress) {
      const reveal = window.confirm(
        "The answer key shows the correct answers and explanations. The student paper does not. Continue?",
      );
      if (!reveal) return;
    }
    setPrintJob({ mode: "key", questionIds: ids });
  }

  function exportResults() {
    const history = storeRef.current?.history ?? [];
    if (history.length === 0) {
      setNote("There are no completed results to export yet.");
      return;
    }
    const csv = resultsToCsv(history);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lantite-practice-results.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function deleteData() {
    const confirmed = window.confirm(
      "Delete all LANTITE practice saved in this browser on this device? This cannot be undone.",
    );
    if (!confirmed) return;
    clearStored(window.localStorage);
    const fresh = emptyStore();
    storeRef.current = fresh;
    setStore(fresh);
    setNote("Practice data was deleted from this browser.");
  }

  function resetTest() {
    if (!storeRef.current?.inProgress) {
      setNote("There is no test in progress to reset.");
      return;
    }
    const confirmed = window.confirm(
      "Clear every answer and flag, and restart the timer, for this same set of questions?",
    );
    if (!confirmed) return;
    const stamp = Date.now();
    update((current) => {
      if (!current.inProgress) return current;
      return {
        ...current,
        inProgress: {
          ...current.inProgress,
          answers: {},
          flagged: [],
          currentIndex: 0,
          timer: freshTimer(stamp),
        },
        ui: { ...current.ui, view: "sit" },
      };
    });
  }

  return (
    <>
      <div className="lantite-app">
        {note ? (
          <p className="lantite-note" role="status">
            {note}
          </p>
        ) : null}
        <div className="lantite-toolbar" aria-label="Practice tools">
          <button type="button" className="lantite-btn lantite-btn-secondary" onClick={resetTest}>
            Reset
          </button>
          <button
            type="button"
            className="lantite-btn lantite-btn-secondary"
            onClick={() => update((current) => ({ ...current, ui: { ...current.ui, view: "setup" } }))}
          >
            New test
          </button>
          <button type="button" className="lantite-btn lantite-btn-secondary" onClick={exportResults}>
            Export results
          </button>
          <button type="button" className="lantite-btn lantite-btn-secondary" onClick={printTest}>
            Print test
          </button>
          <button type="button" className="lantite-btn lantite-btn-secondary" onClick={printKey}>
            Print answer key
          </button>
          {active && store.ui.view === "results" ? (
            <button type="button" className="lantite-btn lantite-btn-secondary" onClick={() => setPrintJob({ mode: "report", attempt: active })}>
              Print report
            </button>
          ) : null}
          <button type="button" className="lantite-btn lantite-btn-danger" onClick={deleteData}>
            Delete my data
          </button>
        </div>
        <p className="text-sm leading-relaxed text-muted">{DATA_NOTICE}</p>

        {store.ui.view === "setup" ? (
          <SetupPanel
            inProgress={store.inProgress}
            onStart={start}
            onResume={() => update((current) => ({ ...current, ui: { ...current.ui, view: "sit" } }))}
            onProgress={() => update((current) => ({ ...current, ui: { ...current.ui, view: "progress" } }))}
          />
        ) : null}

        {store.ui.view === "sit" && store.inProgress ? (
          <SittingView
            attempt={store.inProgress}
            now={now}
            onAnswer={(questionId, index) =>
              update((current) => {
                if (!current.inProgress) return current;
                return {
                  ...current,
                  inProgress: {
                    ...current.inProgress,
                    answers: { ...current.inProgress.answers, [questionId]: index },
                  },
                };
              })
            }
            onFlag={(questionId) =>
              update((current) => {
                if (!current.inProgress) return current;
                const flagged = current.inProgress.flagged.includes(questionId)
                  ? current.inProgress.flagged.filter((id) => id !== questionId)
                  : [...current.inProgress.flagged, questionId];
                return { ...current, inProgress: { ...current.inProgress, flagged } };
              })
            }
            onGo={(index) =>
              update((current) => {
                if (!current.inProgress) return current;
                const next = Math.min(Math.max(0, index), current.inProgress.questionIds.length - 1);
                return { ...current, inProgress: { ...current.inProgress, currentIndex: next } };
              })
            }
            onSubmit={() => submit(false)}
          />
        ) : null}

        {store.ui.view === "results" && active ? (
          <ResultsView
            attempt={active}
            grade={gradeAttempt(active)}
            onReview={() =>
              update((current) => ({ ...current, ui: { ...current.ui, view: "review", reviewIndex: 0 } }))
            }
            onProgress={() => update((current) => ({ ...current, ui: { ...current.ui, view: "progress" } }))}
          />
        ) : null}

        {store.ui.view === "review" && active ? (
          <ReviewSession
            attempt={active}
            index={store.ui.reviewIndex}
            onIndex={(reviewIndex) => update((current) => ({ ...current, ui: { ...current.ui, reviewIndex } }))}
            onBack={() => update((current) => ({ ...current, ui: { ...current.ui, view: "results" } }))}
          />
        ) : null}

        {store.ui.view === "progress" ? (
          <ProgressPanel
            history={store.history}
            onSetup={() => update((current) => ({ ...current, ui: { ...current.ui, view: "setup" } }))}
            onOpen={(id) =>
              update((current) => ({
                ...current,
                ui: { view: "results", activeAttemptId: id, reviewIndex: 0 },
              }))
            }
          />
        ) : null}

        {store.ui.view === "results" && !active ? (
          <p className="lantite-warn" role="alert">
            That result could not be opened. It may have been deleted from this browser.
          </p>
        ) : null}
      </div>

      <div className="lantite-print-root">
        {printJob?.mode === "test" ? <PrintTest questionIds={printJob.questionIds} /> : null}
        {printJob?.mode === "key" ? <PrintKey questionIds={printJob.questionIds} /> : null}
        {printJob?.mode === "report" ? <PrintReport attempt={printJob.attempt} /> : null}
      </div>
    </>
  );
}
