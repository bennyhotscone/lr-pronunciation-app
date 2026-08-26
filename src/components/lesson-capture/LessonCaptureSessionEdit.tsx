"use client";

import { useState, useTransition } from "react";
import { teacherUpdateLessonCaptureSession } from "@/lib/lesson-capture-actions";

export function LessonCaptureSessionEdit(props: {
  sessionId: string;
  initialSummary: string;
  initialAutoNotes: string;
  initialNotes: string;
  initialTopics: string;
}) {
  const [summary, setSummary] = useState(props.initialSummary);
  const [autoNotes, setAutoNotes] = useState(props.initialAutoNotes);
  const [notes, setNotes] = useState(props.initialNotes);
  const [topics, setTopics] = useState(props.initialTopics);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="board-panel mt-6 space-y-3 rounded-xl p-4"
      action={(fd) => {
        fd.set("sessionId", props.sessionId);
        fd.set("summary", summary);
        fd.set("autoNotes", autoNotes);
        fd.set("notes", notes);
        fd.set("topicsCovered", topics);
        setMsg(null);
        startTransition(async () => {
          const res = await teacherUpdateLessonCaptureSession(fd);
          if (res?.error) setMsg(res.error);
          else setMsg("Saved.");
        });
      }}
    >
      <h2 className="text-xs font-bold uppercase text-chalk/50">Edit session notes</h2>
      <label className="block text-sm text-chalk/70">
        AI summary
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-lg border border-chalk/20 bg-black/20 px-3 py-2 text-chalk"
        />
      </label>
      <label className="block text-sm text-chalk/70">
        AI notes
        <textarea
          value={autoNotes}
          onChange={(e) => setAutoNotes(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-chalk/20 bg-black/20 px-3 py-2 text-chalk"
        />
      </label>
      <label className="block text-sm text-chalk/70">
        Teacher notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-chalk/20 bg-black/20 px-3 py-2 text-chalk"
        />
      </label>
      <label className="block text-sm text-chalk/70">
        Topics (comma-separated)
        <input
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          className="mt-1 w-full rounded-lg border border-chalk/20 bg-black/20 px-3 py-2 text-chalk"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn-chalk rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save edits"}
      </button>
      {msg ? <p className="text-sm text-chalk/60">{msg}</p> : null}
    </form>
  );
}