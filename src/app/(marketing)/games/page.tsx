import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vocabulary & Grammar Games",
  description:
    "Build English vocabulary and grammar through games and challenges.",
};

const games = [
  {
    href: "/portal/learn-japanese",
    title: "Learn Japanese",
    subtitle: "日本語 · Five-stage vocabulary training",
    description:
      "Five-stage vocabulary training with mnemonics, audio, and typing drills. Progress saves to your account.",
    className:
      "border-[#c41e3a]/35 bg-gradient-to-br from-[#fff5f6] via-white to-[#fde8ec]",
    mutedClass: "text-muted",
  },
  {
    href: "/english-for-mandarin-speakers",
    title: "English for Mandarin Speakers",
    subtitle: "中文母语者英语课程",
    description: "Frequency-ranked vocabulary listening quiz.",
    className:
      "border-amber bg-gradient-to-br from-amber/30 via-white to-accent-soft",
    mutedClass: "text-muted",
  },
  {
    href: "/english-for-mandarin-speakers/mahjong",
    title: "Mahjong Solitaire",
    subtitle: "Stacked tiles · English ↔ 中文",
    description: "Match English and Chinese while clearing the board.",
    className:
      "border-[#8b5a2b]/40 bg-gradient-to-br from-[#214f3c] via-[#1a4d3a] to-[#16382b] text-[#fffaf0]",
    mutedClass: "text-[#f0e6c8]/85",
  },
  {
    href: "/english-for-mandarin-speakers/review",
    title: "Audio Clip Review",
    subtitle: "Browse recorded clips",
    description: "Review vocabulary audio used in the Mandarin course.",
    className:
      "border-border bg-gradient-to-br from-white via-white to-accent-soft/50",
    mutedClass: "text-muted",
  },
] as const;

export default function GamesHubPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-6">
      <header className="max-w-2xl">
        <p className="chip bg-amber/25 text-foreground">Games</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          Vocabulary & Grammar Games
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Jump into a challenge. Studio tools stay linked from the Mandarin hub
          for teachers.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        {games.map((game) => (
          <Link
            key={game.href}
            href={game.href}
            className={`touch-target group flex flex-col gap-1 rounded-[1.5rem] border-2 px-5 py-5 shadow-md transition hover:brightness-[1.03] sm:px-6 sm:py-6 ${game.className}`}
          >
            <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight sm:text-2xl">
              {game.title}
            </span>
            <span className={`text-sm font-semibold ${game.mutedClass}`}>
              {game.subtitle}
            </span>
            <span className={`mt-1 text-sm ${game.mutedClass}`}>
              {game.description}
            </span>
            <span className="mt-3 text-sm font-bold">
              Open <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
