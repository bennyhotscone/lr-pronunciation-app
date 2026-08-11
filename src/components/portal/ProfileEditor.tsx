"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AVATARS } from "@/lib/avatars";
import { updateStudentProfile } from "@/lib/portal-actions";

export function ProfileEditor({
  preferredName,
  avatarId,
}: {
  preferredName: string;
  avatarId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(avatarId);
  const [name, setName] = useState(preferredName);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-6 space-y-6"
      action={(fd) => {
        setMsg(null);
        setErr(null);
        startTransition(async () => {
          const res = await updateStudentProfile(fd);
          if (res?.error) setErr(res.error);
          else {
            setMsg("Profile saved.");
            router.refresh();
          }
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Preferred name</span>
        <input
          name="preferredName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full max-w-md rounded-xl border border-border bg-background/60 px-3 py-2.5"
        />
      </label>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Avatar</legend>
        <input type="hidden" name="avatarId" value={selected} />
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a.id)}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition ${
                selected === a.id
                  ? "border-sand-accent shadow-md"
                  : "border-transparent bg-surface/60"
              }`}
              style={{ background: a.bg }}
              aria-pressed={selected === a.id}
            >
              <span className="text-3xl" aria-hidden>
                {a.emoji}
              </span>
              <span className="text-xs font-semibold text-[#1a1714]">{a.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {err ? <p className="text-sm font-semibold text-danger">{err}</p> : null}
      {msg ? <p className="text-sm font-semibold text-success">{msg}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary touch-target rounded-2xl px-5 py-3 text-sm font-bold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
