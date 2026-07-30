import type { PronunciationPair } from "@/data/pairs";
import { PAIR_COUNT } from "@/lib/pair-utils";

type Props = {
  pair: PronunciationPair;
  children?: React.ReactNode;
};

const categoryStyles: Record<PronunciationPair["category"], string> = {
  initial: "bg-teal/20 text-teal",
  "consonant-cluster": "bg-accent/15 text-accent",
  "longer-word": "bg-coral/20 text-coral",
  review: "bg-amber/30 text-foreground",
};

export function PairCard({ pair, children }: Props) {
  const percent = Math.round((pair.sequence / PAIR_COUNT) * 100);

  return (
    <section
      className="card relative overflow-hidden rounded-[1.5rem] p-4 sm:p-5"
      aria-labelledby="pair-heading"
    >
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-accent/10 blur-2xl"
      />
      <div className="relative flex flex-wrap items-center gap-2">
        <span className={`chip ${categoryStyles[pair.category]}`}>
          {pair.category.replace("-", " ")}
        </span>
        <span className="chip bg-accent-soft text-accent">
          Pair {pair.sequence} / {PAIR_COUNT}
        </span>
        <span className="chip bg-white text-muted" aria-label={`Difficulty ${pair.difficulty} of 3`}>
          {"★".repeat(pair.difficulty)}
          <span className="opacity-30">{"★".repeat(3 - pair.difficulty)}</span>
        </span>
      </div>

      <div className="relative mt-4 flex items-center justify-center gap-3 text-center">
        <span className="sound-badge sound-badge-l" aria-hidden="true">
          L
        </span>
        <h2
          id="pair-heading"
          className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          <span className="text-teal">{pair.leftWord}</span>
          <span className="mx-2 text-muted" aria-hidden="true">
            —
          </span>
          <span className="text-coral">{pair.rightWord}</span>
        </h2>
        <span className="sound-badge sound-badge-r" aria-hidden="true">
          R
        </span>
      </div>

      <div className="progress-bar mt-4" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs font-medium text-muted">
        Lesson path {percent}% through
      </p>

      {children}
    </section>
  );
}
