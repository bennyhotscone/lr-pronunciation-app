"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  teacherAddGoalChecklistItem,
  teacherToggleGoalChecklistItem,
} from "@/lib/portal-actions";

export function TeacherGoalChecklist({
  goalId,
  items,
}: {
  goalId: string;
  items: { id: string; title: string; done: boolean }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(itemId: string) {
    const fd = new FormData();
    fd.set("itemId", itemId);
    setMsg(null);
    startTransition(async () => {
      const res = await teacherToggleGoalChecklistItem(fd);
      if (res?.error) setMsg(res.error);
      else router.refresh();
    });
  }

  function addItem(fd: FormData) {
    fd.set("goalId", goalId);
    setMsg(null);
    startTransition(async () => {
      const res = await teacherAddGoalChecklistItem(fd);
      if (res?.error) setMsg(res.error);
      else router.refresh();
    });
  }

  const done = items.filter((i) => i.done).length;

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Checklist ({done}/{items.length || 0}) — only you can check off
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.done}
                disabled={pending}
                onChange={() => toggle(item.id)}
                className="mt-0.5 h-4 w-4 accent-foreground"
              />
              <span className={item.done ? "text-muted line-through" : ""}>{item.title}</span>
            </label>
          </li>
        ))}
        {!items.length ? (
          <li className="text-xs text-muted">No steps yet — add some below.</li>
        ) : null}
      </ul>
      <form className="flex flex-wrap gap-2" action={addItem}>
        <input
          name="title"
          required
          placeholder="Add checklist step"
          className="min-w-[10rem] flex-1 rounded-lg border border-border bg-white px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-secondary rounded-lg px-3 py-1 text-xs font-bold"
        >
          Add step
        </button>
      </form>
      {msg ? <p className="text-xs font-semibold text-coral">{msg}</p> : null}
    </div>
  );
}
