import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/portal/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to the LR Mastery student portal or teacher dashboard.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto flex max-w-md flex-col items-stretch justify-center pt-12 sm:pt-20">
      <p className="chip bg-coral/20 text-foreground">Portal</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
        Log in
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Teachers and students sign in with the email and password from your LR Mastery account.
      </p>
      <LoginForm callbackUrl={sp.callbackUrl} />
      <p className="mt-6 text-sm text-muted">
        <Link href="/" className="font-semibold text-foreground underline-offset-2 hover:underline">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
