"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateDailyVocabPractice } from "@/lib/vocab-practice-actions";
import { VOCAB_PRACTICE_DAILY_CAP } from "@/lib/vocab-practice";

export type VocabPackSummary = {
  id: string;
  title: string;
  createdAt: string;
  completedAt: string | null;
  vocabUsed: string[];
};

export function DeskVocabPracticeCard({
  packsToday,
  recentPacks,
  vocabCount,
}: {
  packsToday: number;
  recentPacks: VocabPackSummary[];
  vocabCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const remaining = Math.max(0, VOCAB_PRACTICE_DAILY_CAP - packsToday);

  return (
    <section className="desk-panel rounded-2xl p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
        Generative practice
      </p>
      <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
        Daily vocab story
      </h2>
      <p className="mt-1 text-sm text-ink/55">
        One short story from your target vocabulary, plus comprehension and word activities you can
        finish in the browser. Separate from Guided Story homework.
      </p>
      <p className="mt-2 text-xs text-muted">
        {remaining} of {VOCAB_PRACTICE_DAILY_CAP} left today
        {vocabCount ? ` · ${vocabCount} target words available` : " · add words via PDF Read first"}
      </p>

      <button
        type="button"
        disabled={pending || remaining <= 0}
        className="btn-desk mt-4 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
        onClick={() => {
          setErr(null);
          startTransition(async () => {
            const res = await generateDailyVocabPractice();
            if (res && "error" in res && res.error) {
              setErr(res.error);
              return;
            }
            if (res && "id" in res && res.id) {
              router.push(`/portal/vocab-practice/${res.id}`);
              router.refresh();
            }
          });
        }}
      >
        {pending ? "Generating…" : remaining > 0 ? "Generate practice pack" : "Daily limit reached"}
      </button>
      {err ? <p className="mt-2 text-sm font-semibold text-danger">{err}</p> : null}

      <ul className="mt-4 space-y-2 text-sm">
        {recentPacks.map((p) => (
          <li key={p.id}>
            <Link
              href={`/portal/vocab-practice/${p.id}`}
              className="font-semibold text-desk-accent underline-offset-2 hover:underline"
            >
              {p.completedAt ? "Reopen" : "Continue"}: {p.title}
            </Link>
            <p className="text-xs text-ink/50">
              {new Date(p.createdAt).toLocaleString()}
              {p.completedAt ? " · completed" : " · in progress"}
              {p.vocabUsed.length ? ` · ${p.vocabUsed.slice(0, 4).join(", ")}` : ""}
            </p>
          </li>
        ))}
        {!recentPacks.length ? (
          <li className="text-ink/45">No practice packs yet.</li>
        ) : null}
      </ul>
    </section>
  );
}