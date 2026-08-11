"use client";

import { useState, useTransition } from "react";
import { teacherSaveClassLesson } from "@/lib/classroom-actions";
import { BasketAttachFields, SessionBasketPanel } from "@/components/portal/SessionBasket";
import { TagPicker } from "@/components/classroom/TagPicker";

type Sub = { kind: string; title: string; body: string };

export function ClassLessonEditor({
  classId,
  knownTags,
}: {
  classId: string;
  knownTags: string[];
}) {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card space-y-4 rounded-xl p-4">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Lesson</h2>
      <p className="text-sm text-muted">
        One Lesson = one session writeup for this classroom (topics, notes, homework bits as
        sub-entries). Not the classroom itself.
      </p>

      <SessionBasketPanel />

      <form
        className="space-y-3"
        action={(fd) => {
          fd.set("subEntries", JSON.stringify(subs));
          setMsg(null);
          startTransition(async () => {
            const res = await teacherSaveClassLesson(fd);
            if (res?.error) setMsg(res.error);
            else {
              setMsg("Lesson saved.");
              setSubs([]);
            }
          });
        }}
      >
        <input type="hidden" name="classId" value={classId} />
        <BasketAttachFields />
        <input type="date" name="date" className="rounded border border-border bg-background px-3 py-2" />
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Lesson title (optional)"
          className="w-full rounded border border-border bg-background px-3 py-2"
        />
        <textarea
          name="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          placeholder="What we covered in this session…"
          className="w-full rounded border border-border bg-background px-3 py-2"
        />
        <TagPicker classId={classId} knownTags={knownTags} title={title} body={summary} />

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-muted">Sub-entries</p>
          {subs.map((s, i) => (
            <div key={i} className="grid gap-2 rounded border border-border p-2 sm:grid-cols-3">
              <select
                value={s.kind}
                onChange={(e) => {
                  const next = [...subs];
                  next[i] = { ...s, kind: e.target.value };
                  setSubs(next);
                }}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="TOPIC">Topic</option>
                <option value="NOTE">Note</option>
                <option value="HOMEWORK">Homework</option>
                <option value="FILE">File note</option>
                <option value="OTHER">Other</option>
              </select>
              <input
                value={s.title}
                onChange={(e) => {
                  const next = [...subs];
                  next[i] = { ...s, title: e.target.value };
                  setSubs(next);
                }}
                placeholder="Title"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm sm:col-span-2"
              />
              <input
                value={s.body}
                onChange={(e) => {
                  const next = [...subs];
                  next[i] = { ...s, body: e.target.value };
                  setSubs(next);
                }}
                placeholder="Details (optional)"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm sm:col-span-3"
              />
            </div>
          ))}
          <button
            type="button"
            className="text-sm font-bold text-accent"
            onClick={() => setSubs((prev) => [...prev, { kind: "TOPIC", title: "", body: "" }])}
          >
            + Add sub-entry
          </button>
        </div>

        <button type="submit" disabled={pending} className="btn-primary rounded px-4 py-2 text-sm font-bold disabled:opacity-50">
          Save lesson
        </button>
        {msg ? <p className="text-sm text-success">{msg}</p> : null}
      </form>
    </section>
  );
}
