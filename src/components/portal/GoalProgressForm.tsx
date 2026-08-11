"use client";

import { useTransition } from "react";
import { upsertGoalProgress } from "@/lib/portal-actions";

/** Students can leave notes; they cannot tick checklist items or set % themselves. */
export function GoalProgressForm({
  goalId,
  studentNotes,
}: {
  goalId: string;
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
      <label className="min-w-[12rem] flex-1 text-xs font-semibold">
        Your notes
        <input
          name="studentNotes"
          defaultValue={studentNotes}
          placeholder="How is this going for you?"
          className="mt-1 block w-full rounded-lg border border-border bg-white px-2 py-1"
        />
      </label>
      <button type="submit" disabled={pending} className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-bold">
        Save notes
      </button>
    </form>
  );
}
