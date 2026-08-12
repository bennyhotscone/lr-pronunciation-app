"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestPasswordResetAction } from "@/lib/portal-actions";

export function ForgotPasswordForm({ mailConfigured }: { mailConfigured: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    message: string;
    mailed: boolean;
    mailConfigured: boolean;
    resetUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="mt-8 space-y-4 rounded-2xl border border-border bg-surface/70 p-5">
        <p className="text-sm font-semibold text-foreground" role="status">
          {done.message}
        </p>
        {done.mailed ? (
          <p className="text-sm text-muted">
            Open the link in the email within one hour to choose a new password.
          </p>
        ) : null}
        {done.resetUrl ? (
          <div className="space-y-2 rounded-xl bg-sand-accent/10 px-3 py-3 text-sm">
            <p className="font-semibold">One-time reset link (1 hour):</p>
            <p className="break-all font-mono text-xs text-foreground">{done.resetUrl}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="btn-primary rounded-xl px-3 py-2 text-xs font-bold"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(done.resetUrl!);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={done.resetUrl}
                className="btn-secondary inline-flex rounded-xl px-3 py-2 text-xs font-bold"
              >
                Open link
              </a>
            </div>
          </div>
        ) : null}
        {!done.mailed && !done.resetUrl ? (
          <p className="text-sm text-muted">
            Teachers can also set a password or mint a reset link from the student page under Password
            help.
          </p>
        ) : null}
        <Link
          href="/login"
          className="btn-secondary inline-flex rounded-xl px-4 py-2.5 text-sm font-bold"
        >
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form
      className="mt-8 w-full space-y-4"
      action={(fd) => {
        setError(null);
        setCopied(false);
        startTransition(async () => {
          const result = await requestPasswordResetAction(fd);
          if ("error" in result && result.error) setError(result.error);
          else if (result.ok) {
            setDone({
              message: result.message,
              mailed: result.mailed,
              mailConfigured: result.mailConfigured,
              resetUrl: result.resetUrl,
            });
          }
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-base"
          placeholder="you@example.com"
        />
      </label>
      {error ? (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary touch-target inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold disabled:opacity-60"
      >
        {pending
          ? "Working…"
          : mailConfigured
            ? "Send reset link"
            : "Get reset link"}
      </button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-bold text-sand-accent underline-offset-2 hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
