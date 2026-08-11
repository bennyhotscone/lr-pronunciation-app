import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/portal/SignupForm";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a student account for the LR Mastery portal.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto flex max-w-md flex-col items-stretch justify-center pt-12 sm:pt-20">
      <p className="chip bg-sand-accent/20 text-foreground">Student signup</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
        Create your account
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Students sign up here, then join a classroom with the teacher&apos;s invite code or link.
        Teachers do not create your password. Staff are invited by an admin — no public teacher
        signup.
      </p>
      <SignupForm callbackUrl={sp.callbackUrl} />
      <p className="mt-6 text-sm text-muted">
        Already joining a class?{" "}
        <Link href="/join" className="font-semibold text-sand-accent underline-offset-2 hover:underline">
          Enter invite code
        </Link>
      </p>
      <p className="mt-3 text-sm text-muted">
        <Link href="/" className="font-semibold text-foreground underline-offset-2 hover:underline">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
