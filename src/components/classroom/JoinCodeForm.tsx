"use client";

import { useState, useTransition } from "react";
import { studentJoinClassroomByCode } from "@/lib/classroom-actions";

export function JoinCodeForm({ initialCode = "" }: { initialCode?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-8 space-y-4"
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const res = await studentJoinClassroomByCode(fd);
          if (res?.error) setError(res.error);
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Invite code</span>
        <input
          name="code"
          required
          defaultValue={initialCode}
          autoCapitalize="characters"
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-3 font-mono text-lg tracking-widest uppercase"
          placeholder="K7M2PQ"
        />
      </label>
      {error ? (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join classroom"}
      </button>
    </form>
  );
}
