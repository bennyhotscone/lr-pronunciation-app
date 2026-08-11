"use client";

import { useTransition } from "react";
import { upsertGoalProgress } from "@/lib/portal-actions";

export function GoalProgressForm({
  goalId,
  progressPct,
  studentNotes,
}: {
  goalId: string;
  progressPct: number;
  studentNotes: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      action={(fd) => {
        startTransition(async () => {
          await upsertGoalProgress(fd);
        });
      }}
    >
      <input type="hidden" name="goalId" value={goalId} />
      <label className="text-xs font-semibold">
        Progress %
        <input
          name="progressPct"
          type="number"
          min={0}
          max={100}
          defaultValue={progressPct}
          className="mt-1 block w-24 rounded-lg border border-border bg-white px-2 py-1"
        />
      </label>
      <label className="min-w-[12rem] flex-1 text-xs font-semibold">
        Notes
        <input
          name="studentNotes"
          defaultValue={studentNotes}
          className="mt-1 block w-full rounded-lg border border-border bg-white px-2 py-1"
        />
      </label>
      <button type="submit" disabled={pending} className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-bold">
        Save
      </button>
    </form>
  );
}
