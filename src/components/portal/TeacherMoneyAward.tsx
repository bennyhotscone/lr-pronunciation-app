"use client";

import { useState, useTransition } from "react";
import { teacherAwardMoney } from "@/lib/class-money-actions";

export function TeacherMoneyAward({
  studentId,
  studentLabel,
  balance,
}: {
  studentId: string;
  studentLabel: string;
  balance: number;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <section className="card mt-4 rounded-2xl p-4">
      <h2 className="text-xs font-bold uppercase text-muted">Class money</h2>
      <p className="mt-1 text-sm text-muted">
        Award or adjust class money for <strong>{studentLabel}</strong>. Students ask verbally —
        there is no in-app appeals flow.
      </p>
      <p className="mt-2 text-lg font-bold text-ink">Balance: {balance}</p>
      <form
        className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr_auto]"
        action={(fd) => {
          setMsg(null);
          startTransition(async () => {
            try {
              const res = await teacherAwardMoney(fd);
              if (res?.error) setMsg(res.error);
              else setMsg("Money updated.");
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Could not update money.");
            }
          });
        }}
      >
        <input type="hidden" name="studentId" value={studentId} />
        <input
          name="amount"
          type="number"
          required
          placeholder="Amount"
          className="rounded-xl border border-border bg-white px-3 py-2"
        />
        <input
          name="reason"
          required
          placeholder="Reason (e.g. great participation)"
          className="rounded-xl border border-border bg-white px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-secondary rounded-xl px-4 py-2 text-sm font-bold"
        >
          Award
        </button>
      </form>
      {msg ? <p className="mt-2 text-sm font-semibold">{msg}</p> : null}
    </section>
  );
}