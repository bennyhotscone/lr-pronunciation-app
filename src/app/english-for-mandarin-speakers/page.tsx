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
      <p className="text-center text-sm text-muted">
        <Link
          href="/english-for-mandarin-speakers/review"
          className="underline underline-offset-2"
        >
          Audio clip review (all files)
        </Link>
      </p>
    </div>
  );
}
