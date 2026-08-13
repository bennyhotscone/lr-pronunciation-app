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
  previewWords = [],
}: {
  packsToday: number;
  recentPacks: VocabPackSummary[];
  vocabCount: number;
  previewWords?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const remaining = Math.max(0, VOCAB_PRACTICE_DAILY_CAP - packsToday);
  const chips = previewWords.slice(0, 3);

  function generate() {
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
  }

  return (
    <section className="desk-panel space-y-4 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-desk-accent">
            Practice
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight text-ink sm:text-3xl">
            Daily Vocab Story
          </h2>
          <p className="mt-1.5 text-sm text-ink/55">
            Uses your target vocab · about 3 minutes · {VOCAB_PRACTICE_DAILY_CAP} per day
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-desk-accent/20 bg-[#eef5f2] px-3 py-1.5 text-xs font-bold text-desk-accent">
            Today&apos;s list: {vocabCount} {vocabCount === 1 ? "word" : "words"}
          </span>
          <span className="rounded-full border border-wood/25 bg-[#f7f1df] px-3 py-1.5 text-xs font-bold text-ink/70">
            {remaining > 0 ? `${remaining} left today` : "Daily limit reached"}
          </span>
        </div>
      </div>

      {chips.length ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((w) => (
            <span
              key={w}
              className="rounded-full border border-wood/25 bg-paper px-3 py-1 text-sm font-semibold text-ink"
            >
              {w}
            </span>
          ))}
          {vocabCount > chips.length ? (
            <span className="rounded-full border border-wood/20 bg-paper/80 px-3 py-1 text-sm font-semibold text-ink/50">
              +{vocabCount - chips.length} more
            </span>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-wood/30 bg-paper/80 px-3 py-2 text-sm text-ink/55">
          Add words from PDF Read/Write, then generate a short practice story.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || remaining <= 0}
          onClick={generate}
          className="btn-desk min-h-11 rounded-xl px-5 py-2.5 font-[family-name:var(--font-display)] text-lg font-bold disabled:opacity-50"
        >
          {pending ? "Generating…" : remaining > 0 ? "Make my story" : "Daily limit reached"}
        </button>
        <Link
          href="/portal/stories/open"
          className="text-sm font-semibold text-desk-accent underline-offset-2 hover:underline"
        >
          Guided Story Writer →
        </Link>
      </div>

      {err ? <p className="text-sm font-semibold text-danger">{err}</p> : null}

      <ul className="space-y-2 border-t border-wood/15 pt-4 text-sm">
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
        {!recentPacks.length ? <li className="text-ink/45">No practice packs yet.</li> : null}
      </ul>
    </section>
  );
}
