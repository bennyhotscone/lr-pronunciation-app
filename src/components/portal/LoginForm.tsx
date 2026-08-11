"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { loginAction } from "@/lib/portal-actions";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-8 w-full">
      <form
        className="space-y-4"
        action={(fd) => {
          setError(null);
          startTransition(async () => {
            const result = await loginAction(fd);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {callbackUrl ? (
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        ) : null}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-base"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Password</span>
            <Link
              href="/forgot-password"
              className="text-xs font-bold text-sand-accent underline-offset-2 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
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
          {pending ? "Signing in…" : "Log in"}
        </button>
      </form>

      <div className="mt-6 rounded-2xl border border-border bg-surface/60 p-4 text-center">
        <p className="text-sm text-muted">New student?</p>
        <Link
          href="/signup"
          className="btn-secondary touch-target mt-3 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold"
        >
          Sign up
        </Link>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Students create their own accounts here. Teachers receive accounts from LR Mastery.
        </p>
      </div>
    </div>
  );
}
