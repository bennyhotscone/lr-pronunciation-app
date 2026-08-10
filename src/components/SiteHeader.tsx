import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="relative z-20 flex items-center justify-between gap-4 py-3">
      <Link
        href="/"
        className="touch-target font-[family-name:var(--font-display)] text-lg font-semibold tracking-[0.04em] text-foreground sm:text-xl"
      >
        LR MASTERY
      </Link>
      <Link
        href="/login"
        className="touch-target inline-flex items-center justify-center rounded-xl border border-border bg-white/70 px-3.5 py-2 text-sm font-bold text-foreground transition hover:bg-white"
      >
        Log In
      </Link>
    </header>
  );
}
