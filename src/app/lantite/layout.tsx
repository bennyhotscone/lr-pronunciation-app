import Link from "next/link";
import { BrandWordmark } from "@/components/BrandMark";

export default function LantiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#lantite-main" className="lantite-no-print sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to practice
      </a>
      <header className="lantite-no-print border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="touch-target inline-flex items-center text-foreground">
            <BrandWordmark />
            <span className="sr-only"> Home</span>
          </Link>
          <p className="text-sm text-muted">Literacy practice</p>
        </div>
      </header>
      <div id="lantite-main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {children}
      </div>
    </div>
  );
}
