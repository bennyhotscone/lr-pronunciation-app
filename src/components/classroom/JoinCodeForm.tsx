"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { studentJoinClassroomByCode } from "@/lib/classroom-actions";
import { normalizeInviteCode } from "@/lib/invite-code";

export function JoinCodeForm({
  initialCode = "",
  loginCallbackBase = "/join",
}: {
  initialCode?: string;
  /** Where to send unauthenticated users after login (path prefix or full path). */
  loginCallbackBase?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-6 space-y-4"
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const code = normalizeInviteCode(String(fd.get("code") || ""));
          fd.set("code", code);
          try {
            const res = await studentJoinClassroomByCode(fd);
            if (res && "needAuth" in res && res.needAuth) {
              const cb =
                loginCallbackBase === "/join" || loginCallbackBase.startsWith("/join/")
                  ? `/join/${code}`
                  : `${loginCallbackBase}${loginCallbackBase.includes("?") ? "&" : "?"}code=${encodeURIComponent(code)}`;
              router.push(`/login?callbackUrl=${encodeURIComponent(cb)}`);
              return;
            }
            if (res && "error" in res && res.error) {
              setError(res.error);
              return;
            }
            if (res && "ok" in res && res.ok && res.classId) {
              router.push(`/portal/classrooms/${res.classId}`);
              router.refresh();
              return;
            }
            setError("Could not join. Try again.");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not join. Try again.");
          }
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Invite code</span>
        <input
          name="code"
          required
          defaultValue={initialCode}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-3 font-mono text-lg tracking-widest uppercase"
          placeholder="K7M2PQ"
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
        className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join classroom"}
      </button>
    </form>
  );
}
