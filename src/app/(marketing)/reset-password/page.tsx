import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/portal/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password for your LR Mastery account.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  return (
    <div className="mx-auto flex max-w-md flex-col items-stretch justify-center pt-12 sm:pt-20">
      <p className="chip bg-sand-accent/20 text-foreground">Account</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
        Reset password
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Choose a new password for your account. This link works once and expires after one hour.
      </p>
      <ResetPasswordForm token={token} />
      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="font-semibold text-foreground underline-offset-2 hover:underline">
          ← Back to log in
        </Link>
      </p>
    </div>
  );
}
