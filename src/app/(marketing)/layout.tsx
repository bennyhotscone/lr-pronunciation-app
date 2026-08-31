import { SiteHeader } from "@/components/SiteHeader";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="theme-marketing relative min-h-dvh">
      <div className="landing-nav absolute inset-x-0 top-0 z-30">
        <div className="mx-auto w-full max-w-6xl px-4 pt-2 sm:px-6 lg:px-8">
          <SiteHeader />
        </div>
      </div>
      <main className="relative z-10 w-full">{children}</main>
      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-10 sm:px-6 lg:px-8">
        <span className="font-[family-name:var(--font-display)] text-xs tracking-[0.14em] text-muted">
          LR Mastery
        </span>
      </footer>
    </div>
  );
}
