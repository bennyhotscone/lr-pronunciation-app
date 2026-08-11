"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/lib/portal-actions";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-8 w-full space-y-4"
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
          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-base"
          placeholder="you@example.com"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-base"
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
  );
}
