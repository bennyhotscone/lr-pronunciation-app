"use client";

import { useState, useTransition } from "react";
import { saveDiaryEntry } from "@/lib/portal-actions";

export function DiaryForm() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="card mt-4 space-y-3 rounded-2xl p-4"
      action={(fd) => {
        setMsg(null);
        startTransition(async () => {
          const res = await saveDiaryEntry(fd);
          if (res?.error) setMsg(res.error);
          else {
            setMsg("Saved.");
            (document.getElementById("diary-form") as HTMLFormElement | null)?.reset();
          }
        });
      }}
      id="diary-form"
    >
      <input name="title" placeholder="Title (optional)" className="w-full rounded-xl border border-border bg-white px-3 py-2" />
      <textarea name="body" required rows={4} placeholder="How was today’s practice?" className="w-full rounded-xl border border-border bg-white px-3 py-2" />
      {msg ? <p className="text-sm font-semibold">{msg}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary rounded-xl px-4 py-2 text-sm font-bold">
        Save entry
      </button>
    </form>
  );
}
