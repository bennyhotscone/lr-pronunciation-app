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
    <section className="space-y-3">
      <div className="mockup-chrome relative mx-auto max-w-md overflow-hidden rounded-2xl">
        <img
          src={MOCKUP_UI.dailyVocabCard}
          alt="Daily vocab story"
          className="mockup-img w-full"
          width={1560}
          height={2700}
          decoding="async"
        />

        <div className="pointer-events-none absolute inset-x-[10%] top-[42%] flex flex-col items-center gap-2">
          <p className="mockup-solid-label rounded-full px-3 py-1.5 text-center text-[0.7rem] font-bold">
            Today&apos;s list: {vocabCount} {vocabCount === 1 ? "word" : "words"}
            {remaining ? ` · ${remaining} left today` : " · daily limit reached"}
          </p>
          {chips.length ? (
            <div className="flex max-w-full flex-wrap justify-center gap-1.5">
              {chips.map((w) => (
                <span
                  key={w}
                  className="mockup-solid-label max-w-[6.5rem] truncate rounded-full px-2.5 py-1 text-[0.7rem] font-semibold"
                >
                  {w}
                </span>
              ))}
              {vocabCount > chips.length ? (
                <span className="mockup-solid-label rounded-full px-2.5 py-1 text-[0.7rem] font-semibold">
                  …
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          disabled={pending || remaining <= 0}
          onClick={generate}
          className="absolute bottom-[12%] left-[10%] right-[10%] h-[12%] overflow-hidden rounded-xl disabled:opacity-50"
          aria-label={pending ? "Generating" : remaining > 0 ? "Make my story" : "Daily limit reached"}
        >
          <span
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${MOCKUP_UI.makeStoryBtn})` }}
            aria-hidden
          />
          <span className="relative z-[1] flex h-full items-center justify-center bg-[#1f4e46]/75 px-3 font-[family-name:var(--font-display)] text-lg font-bold text-white">
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
