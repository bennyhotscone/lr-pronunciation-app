"use client";

import { useTransition } from "react";
import { studentToggleSelfHelpChecklistItem } from "@/lib/portal-actions";

/** Checklist on STUDENT_HELP goals — student can tick their own practice steps. */
export function GoalChecklistStudent({
  items,
}: {
  items: { id: string; title: string; done: boolean }[];
}) {
  const [pending, startTransition] = useTransition();
  if (!items.length) return null;
  const done = items.filter((i) => i.done).length;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Competency checks ({done}/{items.length}) — tick when you can do this
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <form
              action={(fd) => {
                startTransition(async () => {
                  await studentToggleSelfHelpChecklistItem(fd);
                });
              }}
            >
              <input type="hidden" name="itemId" value={item.id} />
              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-start gap-2 rounded-md px-1 py-0.5 text-left text-sm hover:bg-[#f3f2ee] disabled:opacity-60"
              >
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                    item.done
                      ? "border-desk-accent bg-desk-accent text-white"
                      : "border-border bg-white text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <span className={item.done ? "text-muted line-through" : "text-ink"}>
                  {item.title}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
