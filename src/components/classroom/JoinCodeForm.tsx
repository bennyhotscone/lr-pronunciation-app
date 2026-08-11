"use client";

import { useState, useTransition } from "react";
import { normalizeInviteCode } from "@/lib/invite-code";

export function JoinCodeForm({
  initialCode = "",
  loginCallbackBase = "/join",
}: {
  initialCode?: string;
  /** Where to send unauthenticated users after login. */
  loginCallbackBase?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const code = normalizeInviteCode(String(fd.get("code") || ""));
        if (code.length < 4) {
          setError("Enter a valid invite code.");
          return;
        }

        startTransition(async () => {
          try {
            const res = await fetch("/api/portal/join", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ code }),
            });
            const data = (await res.json().catch(() => null)) as {
              ok?: boolean;
              classId?: string;
              error?: string;
              needAuth?: boolean;
            } | null;

            if (res.status === 401 || data?.needAuth) {
              const cb =
                loginCallbackBase === "/join" || loginCallbackBase.startsWith("/join/")
                  ? `/join/${code}`
                  : `${loginCallbackBase}${loginCallbackBase.includes("?") ? "&" : "?"}code=${encodeURIComponent(code)}`;
              window.location.assign(`/login?callbackUrl=${encodeURIComponent(cb)}`);
              return;
            }

            if (!res.ok || data?.error) {
              setError(data?.error || `Could not join (${res.status}).`);
              return;
            }

            if (data?.ok && data.classId) {
              // Hard navigation so membership is visible immediately
              window.location.assign(`/portal/classrooms/${data.classId}`);
              return;
            }

            setError("Could not join. Try again.");
          } catch {
            setError("Network error — check your connection and try again.");
          }
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Invite code</span>
        <input
          name="code"
          required
          defaultValue={initialCode}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-wood/30 bg-paper px-3 py-3 font-mono text-lg tracking-widest text-ink uppercase"
          placeholder="K7M2PQ"
        />
      </label>
      {error ? (
        <p
          className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="btn-desk w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join classroom"}
      </button>
    </form>
  );
}
