import type { Metadata } from "next";
import Link from "next/link";
import { MandarinVocabTest } from "@/components/mandarin/MandarinVocabTest";

export const metadata: Metadata = {
  title: "English for Mandarin Speakers · L or R?",
  description:
    "Frequency-ranked English vocabulary listening quiz for Mandarin speakers.",
};

export default function EnglishForMandarinSpeakersPage() {
  return (
    <div className="space-y-4">
      <MandarinVocabTest />
      <Link
        href="/english-for-mandarin-speakers/studio"
        className="touch-target flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-amber/50 bg-gradient-to-br from-amber/30 via-white to-accent-soft/40 px-4 py-4 text-center shadow-md transition hover:brightness-[1.03]"
      >
        <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
          Audio Studio
        </span>
        <span className="text-sm font-semibold text-muted">
          Teacher checklist · ranks 1–50 · play / OK / re-record (password)
        </span>
      </Link>
      <Link
        href="/english-for-mandarin-speakers/mahjong"
        className="touch-target flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-[#8b5a2b]/50 bg-gradient-to-br from-[#214f3c] via-[#1a4d3a] to-[#0e261c] px-4 py-4 text-center text-[#fffaf0] shadow-md shadow-[#0e261c]/30 transition hover:brightness-110"
      >
        <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
          Mahjong Solitaire
        </span>
        <span className="text-sm font-semibold text-[#f0e6c8]/90">
          Stacked board · English ↔ 中文 · groups of 50
        </span>
      </Link>
      <p className="text-center text-sm text-muted">
        <Link
          href="/english-for-mandarin-speakers/review"
          className="underline underline-offset-2"
        >
          Audio clip review
        </Link>
        {" · "}
        <Link
          href="/english-for-mandarin-speakers/studio"
          className="font-bold underline underline-offset-2"
        >
          Audio Studio
        </Link>
      </p>
    </div>
  );
}
