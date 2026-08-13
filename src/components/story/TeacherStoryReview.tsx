"use client";

import { useState, useTransition } from "react";
import {
  teacherSaveStoryFeedback,
  teacherSetPlanApproval,
} from "@/lib/story/actions";
import type { StoryCheckIssue } from "@/lib/story/types";

type Tab =
  | "final"
  | "plan"
  | "process"
  | "revisions"
  | "requirements"
  | "feedback";

export function TeacherStoryReview({
  attemptId,
  status,
  planApproval,
  teacherMustApprovePlan,
  assignment,
  plan,
  sections,
  revisions,
  integrity,
  feedback,
  studentLabel,
}: {
  attemptId: string;
  status: string;
  planApproval: string;
  teacherMustApprovePlan: boolean;
  assignment: {
    title: string;
    instructions: string;
    wordTarget: number;
    cefrLevel: string | null;
    grammarFocus: string[];
    vocabList: string[];
    vocabMinCount: number | null;
    vocabRequireAll: boolean;
  };
  plan: {
    characterName: string | null;
    characterTraits: string | null;
    characterWant: string | null;
    settingPlace: string | null;
    settingTime: string | null;
    settingMood: string | null;
    goalType: string | null;
    goalText: string | null;
    problemType: string | null;
    problemText: string | null;
    complicationText: string | null;
    climaxIdea: string | null;
    resolutionText: string | null;
    events: { label: string; cause: string | null; effect: string | null }[];
  } | null;
  sections: { kind: string; body: string; wordCount: number }[];
  revisions: { passKind: string; completed: boolean; issues: unknown; completedAt: string | null }[];
  integrity: { kind: string; meta: unknown; createdAt: string }[];
  feedback: string | null;
  studentLabel: string;
}) {
  const [tab, setTab] = useState<Tab>("final");
  const [note, setNote] = useState(feedback || "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tabs: { id: Tab; label: string }[] = [
    { id: "final", label: "Final Story" },
    { id: "plan", label: "Plan" },
    { id: "process", label: "Process" },
    { id: "revisions", label: "Revision History" },
    { id: "requirements", label: "Requirements" },
    { id: "feedback", label: "Feedback" },
  ];

  const byKind = Object.fromEntries(sections.map((s) => [s.kind, s]));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted">{studentLabel}</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          {assignment.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Status: {status}
          {teacherMustApprovePlan ? ` · Plan: ${planApproval}` : ""}
        </p>
      </div>

      {teacherMustApprovePlan && planApproval === "PENDING" ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-white/40 p-3">
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-white"
            onClick={() => {
              startTransition(async () => {
                const res = await teacherSetPlanApproval(attemptId, "APPROVED", note);
                setMsg(res?.error || "Plan approved.");
              });
            }}
          >
            Approve plan
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-bold"
            onClick={() => {
              startTransition(async () => {
                const res = await teacherSetPlanApproval(
                  attemptId,
                  "CHANGES_REQUESTED",
                  note,
                );
                setMsg(res?.error || "Changes requested.");
              });
            }}
          >
            Request changes
          </button>
        </div>
      ) : null}

      {msg ? (
        <p className="rounded-xl bg-accent/15 px-3 py-2 text-sm font-semibold" role="status">
          {msg}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === t.id ? "bg-accent text-white" : "border border-border bg-white/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="card rounded-2xl p-4 text-sm">
        {tab === "final" ? (
          <div className="space-y-3 whitespace-pre-wrap leading-relaxed">
            {(["BEGINNING", "MIDDLE", "CLIMAX", "ENDING"] as const).map((k) => (
              <div key={k}>
                <p className="text-xs font-bold uppercase text-muted">{k}</p>
                <p className="mt-1">{byKind[k]?.body || "—"}</p>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "plan" ? (
          <dl className="space-y-2">
            <Row label="Character" value={[plan?.characterName, plan?.characterWant].filter(Boolean).join(" — ")} />
            <Row label="Setting" value={[plan?.settingPlace, plan?.settingTime, plan?.settingMood].filter(Boolean).join(" · ")} />
            <Row label="Goal" value={[plan?.goalType, plan?.goalText].filter(Boolean).join(": ")} />
            <Row label="Problem" value={[plan?.problemType, plan?.problemText].filter(Boolean).join(": ")} />
            <div>
              <dt className="text-xs font-bold uppercase text-muted">Events</dt>
              <dd className="mt-1 space-y-1">
                {(plan?.events || []).map((e, i) => (
                  <p key={i}>
                    {e.label}: {e.cause || "?"} → {e.effect || "?"}
                  </p>
                ))}
              </dd>
            </div>
            <Row label="Complication" value={plan?.complicationText || ""} />
            <Row label="Climax idea" value={plan?.climaxIdea || ""} />
            <Row label="Resolution" value={plan?.resolutionText || ""} />
          </dl>
        ) : null}

        {tab === "process" ? (
          <ul className="space-y-2">
            {integrity.map((ev, i) => {
              const meta = (ev.meta || {}) as Record<string, unknown>;
              const label =
                typeof meta.message === "string"
                  ? meta.message
                  : `${ev.kind}${meta.step ? ` · ${meta.step}` : ""}${
                      meta.wordCount != null ? ` · ${meta.wordCount} words` : ""
                    }`;
              return (
                <li key={i} className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="text-xs text-muted">{new Date(ev.createdAt).toLocaleString()}</p>
                  <p className="font-semibold">{label}</p>
                </li>
              );
            })}
            {!integrity.length ? <li className="text-muted">No process events yet.</li> : null}
          </ul>
        ) : null}

        {tab === "revisions" ? (
          <ul className="space-y-3">
            {revisions.map((r, i) => {
              const issues = (Array.isArray(r.issues) ? r.issues : []) as StoryCheckIssue[];
              return (
                <li key={i} className="rounded-lg border border-border/60 p-3">
                  <p className="font-semibold">
                    {r.passKind}
                    {r.completed ? " ✓" : ""}
                    {r.completedAt ? (
                      <span className="ml-2 text-xs font-normal text-muted">
                        {new Date(r.completedAt).toLocaleString()}
                      </span>
                    ) : null}
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {issues.map((iss, j) => (
                      <li key={j}>{iss.message}</li>
                    ))}
                  </ul>
                </li>
              );
            })}
            {!revisions.length ? <li className="text-muted">No revision passes yet.</li> : null}
          </ul>
        ) : null}

        {tab === "requirements" ? (
          <ul className="space-y-1">
            <li>Target words: {assignment.wordTarget}</li>
            <li>Level: {assignment.cefrLevel || "—"}</li>
            <li>Grammar: {assignment.grammarFocus.join(", ") || "—"}</li>
            <li>
              Vocab: {assignment.vocabList.join(", ") || "—"}
              {assignment.vocabRequireAll ? " (all required)" : ""}
              {assignment.vocabMinCount != null ? ` (min ${assignment.vocabMinCount})` : ""}
            </li>
            <li className="pt-2 text-muted">{assignment.instructions}</li>
          </ul>
        ) : null}

        {tab === "feedback" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Teacher feedback only — no AI probability / cheating score.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-border bg-white px-3 py-2"
              placeholder="Feedback for the student…"
            />
            <button
              type="button"
              disabled={pending}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white"
              onClick={() => {
                startTransition(async () => {
                  const res = await teacherSaveStoryFeedback(attemptId, note);
                  setMsg(res?.error || "Feedback saved.");
                });
              }}
            >
              Save feedback
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}
