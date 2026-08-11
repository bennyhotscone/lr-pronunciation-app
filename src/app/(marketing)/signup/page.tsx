import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/portal/SignupForm";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a student account for the LR Mastery portal.",
};

export default function SignupPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-stretch justify-center pt-12 sm:pt-20">
      <p className="chip bg-sand-accent/20 text-foreground">Student signup</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
        Create your account
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Students sign up here for My Desk. There is{" "}
        <strong className="text-foreground">no public teacher or admin signup</strong> — teachers
        are invited by an LR Mastery admin from{" "}
        <code className="text-sm">/teacher</code> → Invite a teacher, then log in at{" "}
        <Link href="/login" className="font-semibold text-sand-accent underline-offset-2 hover:underline">
          /login
        </Link>
        .
      </p>
      <SignupForm />
      <p className="mt-6 text-sm text-muted">
        <Link href="/" className="font-semibold text-foreground underline-offset-2 hover:underline">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
