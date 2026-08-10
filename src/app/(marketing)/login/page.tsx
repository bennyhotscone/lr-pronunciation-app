import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Student Portal",
  description: "Student portal — coming in Phase 2.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start justify-center pt-16 sm:pt-24">
      <p className="chip bg-coral/20 text-foreground">Portal</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
        Student Portal
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
        Portal coming soon. Lessons, goals, homework, files and your learning
        diary arrive in Phase 2.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="btn-primary touch-target inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold"
        >
          ← Back to home
        </Link>
        <Link
          href="/pronunciation"
          className="btn-secondary touch-target inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold"
        >
          Practise now
        </Link>
      </div>
    </div>
  );
}
