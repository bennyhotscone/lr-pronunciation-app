import { SiteHeader } from "@/components/SiteHeader";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-12 pt-2 sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-20 h-48 w-48 rounded-full bg-sand-accent/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-16 h-44 w-44 rounded-full bg-teal/10 blur-3xl"
      />
      <SiteHeader />
      <main className="relative z-10 flex-1">{children}</main>
      <footer className="relative z-10 mt-10 flex items-center justify-center opacity-50">
        <span className="font-[family-name:var(--font-display)] text-xs tracking-[0.14em] text-muted">
          LR Mastery
        </span>
      </footer>
    </div>
  );
}
