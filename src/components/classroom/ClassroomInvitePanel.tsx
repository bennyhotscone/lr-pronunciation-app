"use client";

import { useMemo, useState } from "react";
import { teacherRegenerateInviteCode } from "@/lib/classroom-actions";

export function ClassroomInvitePanel({
  inviteCode,
  classId,
  joinUrl,
}: {
  inviteCode: string;
  classId: string;
  joinUrl: string;
}) {
  const [code, setCode] = useState(inviteCode);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const liveJoinUrl = useMemo(() => {
    try {
      const u = new URL(joinUrl);
      u.pathname = `/join/${code}`;
      u.search = "";
      u.hash = "";
      return u.toString();
    } catch {
      return `${joinUrl.replace(/\/join\/[^/]+$/, "")}/join/${code}`;
    }
  }, [joinUrl, code]);

  const qrSrc = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(liveJoinUrl)}`,
    [liveJoinUrl],
  );

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied("failed");
    }
  }

  return (
    <section className="board-panel rounded-xl p-5">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-chalk">
        Invite students
      </h2>
      <p className="mt-1 text-sm text-chalk/70">
        Students sign up themselves, then join with this code or link. You do not create their
        passwords.
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-chalk/55">Invite code</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.2em] text-chalk">{code}</p>
            <button
              type="button"
              className="mt-2 text-sm font-bold text-chalk-accent underline-offset-2 hover:underline"
              onClick={() => void copy(code, "code")}
            >
              {copied === "code" ? "Copied!" : "Copy code"}
            </button>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-chalk/55">Invite link</p>
            <p className="mt-1 break-all text-sm text-chalk/90">{liveJoinUrl}</p>
            <button
              type="button"
              className="mt-2 text-sm font-bold text-chalk-accent underline-offset-2 hover:underline"
              onClick={() => void copy(liveJoinUrl, "link")}
            >
              {copied === "link" ? "Copied!" : "Copy link"}
            </button>
          </div>
          <form
            action={async (fd) => {
              setPending(true);
              const res = await teacherRegenerateInviteCode(fd);
              if (res?.ok && res.inviteCode) setCode(res.inviteCode);
              setPending(false);
            }}
          >
            <input type="hidden" name="classId" value={classId} />
            <button
              type="submit"
              disabled={pending}
              className="text-xs font-semibold text-chalk/50 underline-offset-2 hover:underline disabled:opacity-50"
            >
              Generate new code
            </button>
          </form>
        </div>
        <div className="shrink-0 rounded-lg bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="QR code to join classroom" width={180} height={180} />
          <p className="mt-1 text-center text-[0.65rem] font-semibold text-neutral-700">
            Scan to join
          </p>
        </div>
      </div>
    </section>
  );
}
