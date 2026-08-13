"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startFreeStoryPractice } from "@/lib/story/actions";
import { CEFR_LEVELS, GRAMMAR_FOCUS_OPTIONS } from "@/lib/story/types";

export function FreeStoryPracticeCard() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <section className="desk-panel rounded-2xl p-5">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
        Free Story Practice
      </h2>
      <p className="mt-1 text-xs text-ink/50">
        Same guided wizard — no teacher assignment. The guide never writes for you.
      </p>
      {!open ? (
        <button
          type="button"
          className="mt-3 rounded-xl bg-desk-accent px-4 py-2 text-sm font-bold text-paper"
          onClick={() => setOpen(true)}
        >
          Start practice
        </button>
      ) : (
        <form
          className="mt-3 grid gap-3"
          action={(fd) => {
            setMsg(null);
            startTransition(async () => {
              const res = await startFreeStoryPractice(fd);
              if (res?.error) setMsg(res.error);
              else if (res.attemptId) router.push(`/portal/stories/${res.attemptId}`);
            });
          }}
        >
          <input
            name="title"
            placeholder="Optional title"
            className="rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
          />
          <input
            name="topic"
            placeholder="Optional topic"
            className="rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink/60">
              Level
              <select
                name="cefrLevel"
                defaultValue="B1"
                className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
              >
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-ink/60">
              Word target
              <input
                name="wordTarget"
                type="number"
                defaultValue={200}
                min={80}
                max={1000}
                className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-xs font-bold uppercase text-ink/45">Grammar focus</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {GRAMMAR_FOCUS_OPTIONS.map((g) => (
                <label key={g} className="flex items-center gap-1 text-xs">
                  <input type="checkbox" name="grammarFocus" value={g} />
                  {g}
                </label>
              ))}
            </div>
          </fieldset>
          {msg ? <p className="text-sm text-coral">{msg}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-desk-accent px-4 py-2 text-sm font-bold text-paper"
          >
            Open wizard
          </button>
        </form>
      )}
    </section>
  );
}
