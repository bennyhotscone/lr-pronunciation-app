"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signupStudentAction } from "@/lib/portal-actions";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-8 w-full space-y-4"
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const result = await signupStudentAction(fd);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Full name</span>
        <input
          name="fullName"
          required
          autoComplete="name"
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-base"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Preferred name (optional)</span>
        <input
          name="preferredName"
          autoComplete="nickname"
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-base"
        />
      </label>
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
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Password (min 8 characters)</span>
        <input
          name="password"
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
        {pending ? "Creating account…" : "Create student account"}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-sand-accent underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
