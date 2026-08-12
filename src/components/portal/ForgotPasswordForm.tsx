"use client";

import Link from "next/link";
import { useState } from "react";

type DoneState = {
  message: string;
  mailed: boolean;
  mailConfigured: boolean;
  resetUrl?: string;
};

const CLIENT_TIMEOUT_MS = 18_000;

export function ForgotPasswordForm({ mailConfigured }: { mailConfigured: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneState | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

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
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setCopied(false);
        setPending(true);
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") || "").trim();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
        try {
          const res = await fetch("/api/portal/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email }),
            signal: controller.signal,
          });
          const data = (await res.json().catch(() => null)) as
            | {
                ok?: boolean;
                error?: string;
                message?: string;
                mailed?: boolean;
                mailConfigured?: boolean;
                resetUrl?: string | null;
              }
            | null;
          if (!res.ok || !data || data.error) {
            setError(
              data?.error ||
                (controller.signal.aborted
                  ? "Request timed out. Please try again."
                  : "Could not create a reset link. Please try again."),
            );
            return;
          }
          setDone({
            message: data.message || "Check your email or use the link below.",
            mailed: Boolean(data.mailed),
            mailConfigured: Boolean(data.mailConfigured),
            resetUrl: data.resetUrl || undefined,
          });
        } catch (err) {
          const timedOut =
            (err instanceof Error && err.name === "AbortError") ||
            controller.signal.aborted;
          setError(
            timedOut
              ? "Request timed out. Please try again."
              : "Could not create a reset link. Please try again.",
          );
        } finally {
          clearTimeout(timer);
          setPending(false);
        }
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
