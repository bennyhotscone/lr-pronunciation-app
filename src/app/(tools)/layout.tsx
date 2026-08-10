import Link from "next/link";

export default function ToolsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-10 pt-3 sm:max-w-2xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 top-24 h-28 w-28 rounded-full bg-coral/20 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 top-56 h-32 w-32 rounded-full bg-amber/25 blur-2xl"
      />
      <header className="relative z-20 flex items-center justify-between gap-3 py-2">
        <Link
          href="/games"
          className="touch-target text-sm font-bold text-muted transition hover:text-foreground"
        >
          ← Games
        </Link>
        <Link
          href="/"
          className="touch-target font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.04em] text-foreground"
        >
          LR MASTERY
        </Link>
      </header>
      <main className="relative z-10 flex-1 pt-2">{children}</main>
    </div>
  );
}