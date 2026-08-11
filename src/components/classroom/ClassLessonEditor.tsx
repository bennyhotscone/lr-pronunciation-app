"use client";

import { useMemo, useState, useTransition } from "react";
import { teacherSaveClassLesson } from "@/lib/classroom-actions";
import { BasketAttachFields, SessionBasketPanel } from "@/components/portal/SessionBasket";
import { TagPicker } from "@/components/classroom/TagPicker";
import { buildFreeLessonSummary } from "@/lib/lesson-summary";
import { suggestTopicBreakdown } from "@/lib/topic-suggestions";

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

  const existingTopicTitles = useMemo(
    () => subs.filter((s) => s.kind === "TOPIC").map((s) => s.title),
    [subs],
  );

  const packs = useMemo(
    () => suggestTopicBreakdown(title, summary, existingTopicTitles),
    [title, summary, existingTopicTitles],
  );

  const preview = useMemo(
    () =>
      buildFreeLessonSummary({
        title,
        summary,
        subEntries: subs,
      }),
    [title, summary, subs],
  );

  function addTopic(item: string) {
    setSubs((prev) => {
      if (prev.some((s) => s.kind === "TOPIC" && s.title.trim().toLowerCase() === item.toLowerCase())) {
        return prev;
      }
      return [...prev, { kind: "TOPIC", title: item, body: "" }];
    });
  }

  function addAllFromPack(items: string[]) {
    setSubs((prev) => {
      const have = new Set(
        prev.filter((s) => s.kind === "TOPIC").map((s) => s.title.trim().toLowerCase()),
      );
      const next = [...prev];
      for (const item of items) {
        if (have.has(item.toLowerCase())) continue;
        have.add(item.toLowerCase());
        next.push({ kind: "TOPIC", title: item, body: "" });
      }
      return next;
    });
  }

  function toggleTopic(item: string) {
    setSubs((prev) => {
      const idx = prev.findIndex(
        (s) => s.kind === "TOPIC" && s.title.trim().toLowerCase() === item.toLowerCase(),
      );
      if (idx >= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      return [...prev, { kind: "TOPIC", title: item, body: "" }];
    });
  }

  function isAdded(item: string) {
    return existingTopicTitles.some((t) => t.trim().toLowerCase() === item.toLowerCase());
  }

  return (
    <section className="card space-y-4 rounded-xl p-4">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Lesson</h2>
      <p className="text-sm text-muted">
        One Lesson = one session writeup. Type a topic (e.g. “narrative tenses”) and click suggested
        checkboxes to log what you covered — free, no paid AI.
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
              setTitle("");
              setSummary("");
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
          placeholder='What we covered… try “narrative tenses” or “present perfect”'
          className="w-full rounded border border-border bg-background px-3 py-2"
        />

        {packs.length ? (
          <div className="space-y-3 rounded-lg border border-border bg-background/60 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Suggested breakdown (free)
            </p>
            {packs.map((pack) => (
              <div key={pack.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{pack.label}</p>
                  <button
                    type="button"
                    className="text-xs font-bold text-accent"
                    onClick={() => addAllFromPack(pack.items)}
                  >
                    Add all
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {pack.items.map((item) => {
                    const checked = isAdded(item);
                    return (
                      <li key={item}>
                        <button
                          type="button"
                          onClick={() => (checked ? toggleTopic(item) : addTopic(item))}
                          className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition ${
                            checked
                              ? "border-accent/40 bg-accent/10 text-foreground"
                              : "border-border bg-card text-foreground hover:border-accent/50"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                              checked
                                ? "border-accent bg-accent text-accent-foreground"
                                : "border-border bg-background"
                            }`}
                          >
                            {checked ? "✓" : ""}
                          </span>
                          <span>{item}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        <TagPicker classId={classId} knownTags={knownTags} title={title} body={summary} enableAi={false} />

        <div className="rounded-lg border border-border bg-background/50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Student summary preview (free)
          </p>
          <p className="mt-1 text-sm text-foreground">{preview}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-muted">Topics & sub-entries</p>
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
