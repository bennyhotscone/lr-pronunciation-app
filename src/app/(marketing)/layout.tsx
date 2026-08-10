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
        className="pointer-events-none absolute -left-16 top-20 h-40 w-40 rounded-full bg-coral/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-10 h-44 w-44 rounded-full bg-amber/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-24 left-1/3 h-36 w-36 rounded-full bg-teal/20 blur-3xl"
      />
      <SiteHeader />
      <main className="relative z-10 flex-1">{children}</main>
    </div>
  );
}
