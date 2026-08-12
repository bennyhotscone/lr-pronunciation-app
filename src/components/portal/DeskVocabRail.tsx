"use client";

import Link from "next/link";
import { useState } from "react";

export type DeskVocabItem = {
  id: string;
  word: string;
  translation: string | null;
  lookupCount: number;
  frequencyRank: number | null;
  targetLang: string;
};

const PREVIEW = 8;

export function DeskVocabRail({
  entries,
  targetLang,
}: {
  entries: DeskVocabItem[];
  targetLang: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entries : entries.slice(0, PREVIEW);
  const more = entries.length - PREVIEW;

  return (
    <section className="desk-panel rounded-2xl border-desk-accent/25 p-5 ring-1 ring-desk-accent/20">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
            Always on your desk
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
            Target vocabulary
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Words you tap in PDF read/write mode ({targetLang}). Ordered by commonality, then how
            often you looked them up.
          </p>
        </div>
        <Link
          href="/portal/profile"
          className="text-sm font-bold text-desk-accent underline-offset-2 hover:underline"
        >
          Language →
        </Link>
      </div>

      {entries.length ? (
        <>
          <ul className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {visible.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-wood/20 bg-paper px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-ink">{e.word}</p>
                  <p className="text-[0.65rem] font-bold uppercase tracking-wide text-ink/40">
                    {e.frequencyRank != null ? `#${e.frequencyRank}` : "unranked"}
                    {" · "}
                    {e.lookupCount}×
                  </p>
                </div>
                {e.translation ? (
                  <p className="mt-0.5 text-sm text-ink/65">{e.translation}</p>
                ) : null}
              </li>
            ))}
          </ul>
          {more > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-sm font-bold text-desk-accent hover:underline"
            >
              {expanded ? "Show less" : `Show ${more} more`}
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-wood/30 bg-paper/70 px-4 py-3 text-sm text-ink/60">
          No target words yet. Open a class PDF in{" "}
          <strong className="font-semibold text-ink">Read</strong> or{" "}
          <strong className="font-semibold text-ink">Write</strong> mode and tap a word to translate
          it — it lands here.
        </p>
      )}
    </section>
  );
}
