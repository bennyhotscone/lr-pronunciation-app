import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/portal/ForgotPasswordForm";
import { isMailConfigured } from "@/lib/mail";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset your LR Mastery account password.",
};

export default function ForgotPasswordPage() {
  const mailConfigured = isMailConfigured();

  return (
    <div className="mx-auto flex max-w-md flex-col items-stretch justify-center pt-12 sm:pt-20">
      <p className="chip bg-sand-accent/20 text-foreground">Account</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
        Forgot password
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        {mailConfigured
          ? "Enter your account email. We email a one-time reset link valid for one hour."
          : "Enter your account email. Email delivery is not configured on this server — if the account exists, a one-time reset link will appear on this page (valid 1 hour)."}
      </p>
      <ForgotPasswordForm mailConfigured={mailConfigured} />
      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="font-semibold text-foreground underline-offset-2 hover:underline">
          ← Back to log in
        </Link>
      </p>
    </div>
  );
}
