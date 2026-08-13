"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateDailyVocabPractice } from "@/lib/vocab-practice-actions";
import { VOCAB_PRACTICE_DAILY_CAP } from "@/lib/vocab-practice";
import { MOCKUP_UI } from "@/lib/mockup-ui";

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
    <section className="space-y-3">
      <div className="mockup-chrome relative mx-auto max-w-md overflow-hidden rounded-2xl shadow-md">
        <img
          src={MOCKUP_UI.dailyVocabCard}
          alt="Daily vocab story"
          className="mockup-img w-full"
          width={1560}
          height={2700}
          decoding="async"
        />
        <div className="pointer-events-none absolute inset-x-[8%] top-[8%] rounded-lg bg-[#f7f3e8]/85 px-3 py-2 text-center shadow-sm">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-desk-accent">
            Generative practice
          </p>
          <p className="text-xs text-ink/70">
            {remaining} of {VOCAB_PRACTICE_DAILY_CAP} left today
            {vocabCount ? ` · ${vocabCount} target words` : " · add words via PDF Read first"}
          </p>
        </div>
        <button
          type="button"
          disabled={pending || remaining <= 0}
          onClick={generate}
          className="absolute bottom-[14%] left-[10%] right-[10%] h-[11%] overflow-hidden rounded-xl disabled:opacity-50"
          aria-label={pending ? "Generating" : remaining > 0 ? "Make my story" : "Daily limit reached"}
        >
          <span
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${MOCKUP_UI.makeStoryBtn})` }}
            aria-hidden
          />
          <span className="relative z-[1] flex h-full items-center justify-center px-3 font-[family-name:var(--font-display)] text-lg font-bold text-white drop-shadow">
            {pending ? "Generating…" : remaining > 0 ? "Make my story" : "Daily limit reached"}
          </span>
        </button>
      </div>
      {err ? <p className="text-sm font-semibold text-danger">{err}</p> : null}

      <ul className="space-y-2 text-sm">
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
      <p className="text-xs text-ink/50">
        <Link href="/portal/stories/open" className="font-semibold text-desk-accent hover:underline">
          Guided Story Writer →
        </Link>
      </p>
    </section>
  );
}