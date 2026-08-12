"use client";

import Link from "next/link";
import { useState } from "react";

const CLIENT_TIMEOUT_MS = 18_000;

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <div className="mt-8 rounded-2xl border border-border bg-surface/70 p-5 text-sm">
        <p className="font-semibold text-danger">This reset link is missing a token.</p>
        <Link href="/forgot-password" className="mt-3 inline-block font-bold text-sand-accent underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (ok) {
    return (
      <div className="mt-8 space-y-4 rounded-2xl border border-border bg-surface/70 p-5">
        <p className="text-sm font-semibold text-success" role="status">
          Password updated. You can log in with your new password.
        </p>
        <Link
          href="/login"
          className="btn-primary inline-flex rounded-xl px-4 py-2.5 text-sm font-bold"
        >
          Go to log in
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
        setPending(true);
        const fd = new FormData(e.currentTarget);
        const password = String(fd.get("password") || "");
        const confirm = String(fd.get("confirm") || "");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
        try {
          const res = await fetch("/api/portal/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ token, password, confirm }),
            signal: controller.signal,
          });
          const data = (await res.json().catch(() => null)) as
            | { ok?: boolean; error?: string }
            | null;
          if (!res.ok || !data?.ok) {
            setError(
              data?.error ||
                (controller.signal.aborted
                  ? "Request timed out. Please try again."
                  : "Could not update password. Please try again."),
            );
            return;
          }
          setOk(true);
        } catch (err) {
          const timedOut =
            (err instanceof Error && err.name === "AbortError") ||
            controller.signal.aborted;
          setError(
            timedOut
              ? "Request timed out. Please try again."
              : "Could not update password. Please try again.",
          );
        } finally {
          clearTimeout(timer);
          setPending(false);
        }
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">New password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-base"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Confirm password</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-base"
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
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
