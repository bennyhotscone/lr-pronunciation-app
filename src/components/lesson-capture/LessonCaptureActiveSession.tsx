"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  teacherAddLessonCaptureNote,
  teacherCancelLessonCapture,
  teacherEndLessonCapture,
} from "@/lib/lesson-capture-actions";
import {
  BasketAttachFields,
  SessionBasketPanel,
  useSessionBasket,
} from "@/components/portal/SessionBasket";
import {
  ScreenCaptureProvider,
  useLessonCaptureScreenCapture,
} from "@/hooks/useLessonCaptureScreenCapture";

type LiveNote = {
  id: string;
  body: string;
  createdAt: string;
};

function SessionTimer({ startedAt, frameCount }: { startedAt: string; frameCount: number }) {
  const [elapsed, setElapsed] = useState("0:00");

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    function tick() {
      const sec = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      setElapsed(`${m}:${String(s).padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-lg bg-chalk-accent/15 px-3 py-1 font-mono text-sm font-bold text-chalk-accent">
        {elapsed}
      </span>
      <span className="rounded-lg bg-black/30 px-3 py-1 font-mono text-xs font-bold text-chalk/80">
        {frameCount} frames
      </span>
    </div>
  );
}

function ScreenCapturePanel() {
  const {
    capturing,
    framesUploaded,
    pendingUploads,
    nextInSec,
    error,
    startCapture,
    stopCapture,
  } = useLessonCaptureScreenCapture();

  return (
    <section className="board-panel space-y-3 rounded-xl border border-chalk/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-chalk">
            Screen capture
          </h2>
          <p className="mt-1 text-sm text-chalk/60">
            Required for OCR lesson memory — auto-screenshot every 60s while you teach. On End,
            screenshots are OCR&apos;d, then Groq builds summary/notes. Frames are deleted after
            a successful run.
          </p>
        </div>
        {capturing ? (
          <span className="rounded-lg bg-red-500/20 px-3 py-1 text-sm font-bold text-red-300">
            LIVE — next {nextInSec}s
          </span>
        ) : null}
      </div>
      {!capturing ? (
        <button
          type="button"
          onClick={() => void startCapture()}
          className="btn-chalk rounded-lg px-4 py-3 text-sm font-bold"
        >
          Start screen capture
        </button>
      ) : (
        <button
          type="button"
          onClick={stopCapture}
          className="rounded-lg border border-chalk/25 px-4 py-2 text-sm font-semibold text-chalk/80"
        >
          Stop screen share
        </button>
      )}
      <p className="text-xs text-chalk/50">
        {framesUploaded} uploaded
        {pendingUploads ? ` — ${pendingUploads} pending` : ""}
      </p>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </section>
  );
}

function EndSessionForm({
  sessionId,
  llmReady,
  onEnded,
}: {
  sessionId: string;
  llmReady: boolean;
  onEnded: (processing: boolean) => void;
}) {
  const { clearBasket } = useSessionBasket();
  const { stopCapture, capturing } = useLessonCaptureScreenCapture();
  const [topics, setTopics] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="board-panel space-y-3 rounded-xl p-4"
      action={(fd) => {
        fd.set("sessionId", sessionId);
        fd.set("topicsCovered", topics);
        fd.set("notes", extraNotes);
        setMsg(null);
        startTransition(async () => {
          if (capturing) stopCapture();
          const res = await teacherEndLessonCapture(fd);
          if (res?.error) {
            setMsg(res.error);
            return;
          }
          clearBasket();
          onEnded(Boolean(res?.processing));
        });
      }}
    >
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-chalk">
        End & save lesson memory
      </h3>
      <p className="text-sm text-chalk/65">
        On End: OCR your screenshots, then Groq turns OCR text + your typed notes into a lasting
        summary, auto-notes, topics, and timeline. Frames are deleted after a successful run.
      </p>
      {!llmReady ? (
        <p className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
          No LLM key yet — add free <code>GROQ_API_KEY</code> to <code>.env.local</code>{" "}
          (console.groq.com) and restart so End Session can build AI lesson memory.
        </p>
      ) : null}
      <BasketAttachFields />
      <input
        value={topics}
        onChange={(e) => setTopics(e.target.value)}
        placeholder="Topics covered, e.g. past tense, phrasal verbs"
        className="w-full rounded-lg border border-chalk/20 bg-black/20 px-3 py-2 text-chalk placeholder:text-chalk/35"
      />
      <textarea
        value={extraNotes}
        onChange={(e) => setExtraNotes(e.target.value)}
        rows={3}
        placeholder="Final summary notes (optional)"
        className="w-full rounded-lg border border-chalk/20 bg-black/20 px-3 py-2 text-chalk placeholder:text-chalk/35"
      />
      <button
        type="submit"
        disabled={pending}
        className="btn-chalk rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
      >
        {pending ? "Saving..." : "End & build lesson memory"}
      </button>
      {msg ? <p className="text-sm text-red-300">{msg}</p> : null}
    </form>
  );
}

function ActiveSessionBody({
  sessionId,
  studentLabel,
  startedAt,
  llmReady,
  initialNotes,
}: {
  sessionId: string;
  studentLabel: string;
  startedAt: string;
  llmReady: boolean;
  initialNotes: LiveNote[];
}) {
  const router = useRouter();
  const { framesUploaded } = useLessonCaptureScreenCapture();
  const [notes, setNotes] = useState<LiveNote[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const [notePending, startNoteTransition] = useTransition();

  function addNote() {
    const body = draft.trim();
    if (!body) return;
    const fd = new FormData();
    fd.set("sessionId", sessionId);
    fd.set("body", body);
    setNoteMsg(null);
    startNoteTransition(async () => {
      const res = await teacherAddLessonCaptureNote(fd);
      if (res?.error) {
        setNoteMsg(res.error);
        return;
      }
      if (res?.note) {
        setNotes((prev) => [
          ...prev,
          {
            id: res.note.id,
            body: res.note.body,
            createdAt: res.note.createdAt.toISOString(),
          },
        ]);
      }
      setDraft("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-chalk/50">Live session</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-chalk">
            {studentLabel}
          </h1>
        </div>
        <SessionTimer startedAt={startedAt} frameCount={framesUploaded} />
      </div>

      <ScreenCapturePanel />

      <section className="board-panel space-y-3 rounded-xl p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-chalk">
          Quick notes
        </h2>
        <p className="text-sm text-chalk/65">
          Teacher notes feed Groq alongside OCR from screenshots — type as you go; timestamps
          are added automatically.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addNote();
              }
            }}
            placeholder="e.g. Reviewed homework page 3..."
            className="min-w-[200px] flex-1 rounded-lg border border-chalk/20 bg-black/20 px-3 py-2 text-chalk placeholder:text-chalk/35"
          />
          <button
            type="button"
            disabled={notePending || !draft.trim()}
            onClick={addNote}
            className="btn-chalk rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            Add note
          </button>
        </div>
        {noteMsg ? <p className="text-sm text-red-300">{noteMsg}</p> : null}
        {notes.length ? (
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-chalk/85">
            {notes.map((n) => (
              <li key={n.id}>
                <span className="font-mono text-xs text-chalk/45">{n.createdAt.slice(11, 16)}</span>{" "}
                {n.body}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-chalk/45">No notes yet.</p>
        )}
      </section>

      <SessionBasketPanel />

      <EndSessionForm
        sessionId={sessionId}
        llmReady={llmReady}
        onEnded={() => {
          router.refresh();
        }}
      />

      <form action={async (fd) => { await teacherCancelLessonCapture(fd); }}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <button
          type="submit"
          className="text-sm font-semibold text-chalk/45 underline-offset-2 hover:text-red-300 hover:underline"
        >
          Discard session without saving
        </button>
      </form>
    </div>
  );
}

export function LessonCaptureActiveSession(props: {
  sessionId: string;
  studentLabel: string;
  startedAt: string;
  llmReady?: boolean;
  /** @deprecated use llmReady */
  visionReady?: boolean;
  initialNotes: LiveNote[];
}) {
  return (
    <ScreenCaptureProvider sessionId={props.sessionId}>
      <ActiveSessionBody
        sessionId={props.sessionId}
        studentLabel={props.studentLabel}
        startedAt={props.startedAt}
        llmReady={props.llmReady ?? props.visionReady ?? false}
        initialNotes={props.initialNotes}
      />
    </ScreenCaptureProvider>
  );
}

export function LessonCaptureProcessingView({
  sessionId,
  studentLabel,
}: {
  sessionId: string;
  studentLabel: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router, sessionId]);

  return (
    <div className="board-panel mt-6 space-y-3 rounded-xl p-6 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-chalk/50">Building lesson memory</p>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-chalk">
        {studentLabel}
      </h2>
      <p className="text-sm text-chalk/70">
        Running OCR on screenshots, then Groq analysis for summary, auto-notes, and topics.
        Frames are deleted after a successful run.
      </p>
      <p className="animate-pulse text-sm text-chalk-accent">Working...</p>
    </div>
  );
}