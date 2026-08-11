"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { freeInfoTagLinks, normalizeTag } from "@/lib/info-tag-links";
import { studentAddTopicHelpGoal } from "@/lib/portal-actions";

const KIND_LABEL: Record<string, string> = {
  video: "Videos",
  explain: "Explanations",
  exercise: "Exercises",
  listen: "Listening",
};

/**
 * Free “I need more help” panel — curated public links + optional add-to-goals.
 * No LLM / no API keys / $0 running cost.
 */
export function TopicHelpButton({
  topics,
  classId,
  defaultTopic,
}: {
  /** Lesson tags and/or title phrases students can pick. */
  topics: string[];
  classId?: string;
  defaultTopic?: string;
}) {
  const options = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of topics) {
      const t = normalizeTag(raw);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }, [topics]);

  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(
    () => normalizeTag(defaultTopic || options[0] || ""),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!options.length && !defaultTopic) return null;

  const active = normalizeTag(topic || options[0] || "");
  const links = active ? freeInfoTagLinks(active) : [];
  const grouped = {
    video: links.filter((l) => l.kind === "video"),
    explain: links.filter((l) => l.kind === "explain"),
    exercise: links.filter((l) => l.kind === "exercise"),
    listen: links.filter((l) => l.kind === "listen"),
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setMsg(null);
        }}
        className="btn-secondary rounded-md px-3 py-2 text-sm font-bold"
      >
        {open ? "Hide extra help" : "I need more help with this topic"}
      </button>

      {open ? (
        <div className="mt-3 space-y-4 rounded-xl border border-desk-accent/30 bg-[#f3f2ee] p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
              Free study help
            </p>
            <p className="mt-1 text-sm text-muted">
              Links open free public sites (YouTube search, British Council, BBC, grammar
              practice). No paid AI — pick good ones yourself.
            </p>
          </div>

          {options.length > 1 ? (
            <label className="block text-sm">
              <span className="font-semibold text-ink">Topic</span>
              <select
                className="mt-1 w-full rounded border border-border bg-white px-3 py-2"
                value={active}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setMsg(null);
                }}
              >
                {options.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm font-semibold text-ink">Topic: {active}</p>
          )}

          {(["video", "explain", "exercise", "listen"] as const).map((kind) => {
            const list = grouped[kind];
            if (!list.length) return null;
            return (
              <div key={kind}>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {KIND_LABEL[kind]}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {list.map((l) => (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-desk-accent underline-offset-2 hover:underline"
                      >
                        {l.label}
                      </a>
                      <span className="text-sm text-muted"> — {l.blurb}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="border-t border-border pt-3">
            <p className="text-sm font-semibold text-ink">Add to my learning goals</p>
            <p className="mt-1 text-xs text-muted">
              Creates a self-study goal with a home practice checklist. You can tick your own
              steps; teacher goals stay teacher-checked.
            </p>
            <form
              className="mt-2"
              action={(fd) => {
                setMsg(null);
                startTransition(async () => {
                  const res = await studentAddTopicHelpGoal(fd);
                  if (res?.error) setMsg(res.error);
                  else {
                    setMsg(
                      res.created
                        ? "Added to your Goals. Open Goals to track your checklist."
                        : "Updated your existing self-study goal for this topic.",
                    );
                  }
                });
              }}
            >
              <input type="hidden" name="topic" value={active} />
              {classId ? <input type="hidden" name="classId" value={classId} /> : null}
              <button
                type="submit"
                disabled={pending || !active}
                className="btn-primary rounded-md px-3 py-2 text-sm font-bold disabled:opacity-50"
              >
                {pending ? "Saving…" : "Add to my goals"}
              </button>
            </form>
            {msg ? (
              <p className="mt-2 text-sm text-success">
                {msg}{" "}
                <Link href="/portal/goals" className="font-bold underline-offset-2 hover:underline">
                  View Goals →
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
