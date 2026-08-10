import { AppHeader } from "@/components/AppHeader";

export default function PronunciationLayout({
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
        className="pointer-events-none absolute -right-8 top-56 h-32 w-32 rounded-full bg-accent/20 blur-2xl"
      />
      <AppHeader />
      <main className="relative z-10 flex-1 pt-4">{children}</main>
    </div>
  );
}
