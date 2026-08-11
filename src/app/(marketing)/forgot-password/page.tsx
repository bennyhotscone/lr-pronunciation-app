import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/portal/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a password reset link for your LR Mastery account.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-stretch justify-center pt-12 sm:pt-20">
      <p className="chip bg-sand-accent/20 text-foreground">Account</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
        Forgot password
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Enter your account email. We create a one-time reset link (valid 1 hour) and email it when
        mail is configured.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="font-semibold text-foreground underline-offset-2 hover:underline">
          ← Back to log in
        </Link>
      </p>
    </div>
  );
}
