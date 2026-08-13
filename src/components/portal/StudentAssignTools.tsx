"use client";

import { useState, useTransition } from "react";
import { teacherAddGoal } from "@/lib/portal-actions";

/**
 * Classroom-first: competency skills checklists for a student.
 * Individual "just-for-you lessons/files" removed from the main path — those belong in a Classroom.
 */
export function StudentAssignTools({
  studentId,
  studentLabel,
}: {
  studentId: string;
  studentLabel: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-8 space-y-6">
      <p className="text-sm text-muted">
        Skills for <strong>{studentLabel}</strong>. Put shared materials in their{" "}
        <strong>Classroom</strong> (stream / lesson / files), not as one-off assignments here.
      </p>
      {msg ? (
        <p className="rounded-xl bg-coral/15 px-3 py-2 text-sm font-semibold" role="status">
          {msg}
        </p>
      ) : null}

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Add skills checklist
        </h2>
        <p className="mt-1 text-xs text-muted">
          Competency checks (one can-do per line, e.g. “I can use past simple for main events”).
          Only you confirm teacher skills — for accountability.
        </p>
        <form
          className="mt-3 grid gap-3"
          action={(fd) => {
            setMsg(null);
            startTransition(async () => {
              const res = await teacherAddGoal(fd);
              if (res?.error) setMsg(res.error);
              else setMsg("Skills checklist created.");
            });
          }}
        >
          <input type="hidden" name="studentId" value={studentId} />
          <input
            name="title"
            required
            placeholder="Skill area (e.g. Narrative tenses)"
            className="rounded-xl border border-border bg-white px-3 py-2"
          />
          <textarea
            name="description"
            rows={2}
            placeholder="What competent looks like for this student"
            className="rounded-xl border border-border bg-white px-3 py-2"
          />
          <label className="text-xs font-semibold text-muted">
            Pyramid tier
            <select
              name="pyramidTier"
              defaultValue="2"
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink"
            >
              <option value="1">1 — General foundation (base)</option>
              <option value="2">2 — Focus area (middle)</option>
              <option value="3">3 — Specialized target (tip)</option>
            </select>
          </label>
          <textarea
            name="checklistItems"
            rows={4}
            placeholder={
              "Can-do checks (one per line)\ne.g. I can use past simple for main events\nI can use past continuous for background\nI can tell a short story using these tenses"
            }
            className="rounded-xl border border-border bg-white px-3 py-2"
          />
          <button
            type="submit"
            disabled={pending}
            className="btn-secondary rounded-xl px-4 py-2 text-sm font-bold"
          >
            Add skills checklist
          </button>
        </form>
      </section>
    </div>
  );
}
