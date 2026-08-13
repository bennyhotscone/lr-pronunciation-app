"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveVocabPracticeAnswers } from "@/lib/vocab-practice-actions";
import type { VocabPracticeActivities } from "@/lib/vocab-practice";

type AnswersState = {
  comprehension?: Record<string, number>;
  vocab?: Record<string, string>;
};

export function VocabPracticePlayer({
  packId,
  title,
  story,
  vocabUsed,
  activities,
  initialAnswers,
  completedAt,
}: {
  packId: string;
  title: string;
  story: string;
  vocabUsed: string[];
  activities: VocabPracticeActivities;
  initialAnswers: AnswersState;
  completedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<AnswersState>(initialAnswers || {});
  const [msg, setMsg] = useState<string | null>(null);
  const [checked, setChecked] = useState(Boolean(completedAt));

  const score = useMemo(() => {
    let right = 0;
    let total = 0;
    for (const q of activities.comprehension || []) {
      total += 1;
      if (answers.comprehension?.[q.id] === q.answerIndex) right += 1;
    }
    for (const a of activities.vocabActivities || []) {
      if (a.kind === "use") continue;
      total += 1;
      const got = (answers.vocab?.[a.id] || "").trim().toLowerCase();
      if (got && got === a.expected.trim().toLowerCase()) right += 1;
    }
    return { right, total };
  }, [activities, answers]);

  function persist(complete: boolean) {
    setMsg(null);
    const fd = new FormData();
    fd.set("packId", packId);
    fd.set("answers", JSON.stringify(answers));
    if (complete) fd.set("complete", "1");
    startTransition(async () => {
      const res = await saveVocabPracticeAnswers(fd);
      if (res && "error" in res && res.error) setMsg(res.error);
      else {
        setMsg(complete ? "Saved and marked complete." : "Progress saved.");
        if (complete) setChecked(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          Target words: {vocabUsed.join(", ") || "—"}
          {checked ? " · completed" : ""}
        </p>
      </div>

      <section className="desk-panel rounded-2xl p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-desk-accent">Story</h2>
        <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-ink">{story}</p>
      </section>

      <section className="desk-panel rounded-2xl p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-desk-accent">
          Comprehension
        </h2>
        <ul className="mt-3 space-y-4">
          {(activities.comprehension || []).map((q) => (
            <li key={q.id}>
              <p className="font-semibold text-ink">{q.prompt}</p>
              <div className="mt-2 space-y-1.5">
                {q.choices.map((choice, idx) => {
                  const selected = answers.comprehension?.[q.id] === idx;
                  const showKey = checked;
                  const correct = idx === q.answerIndex;
                  return (
                    <label
                      key={`${q.id}-${idx}`}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                        selected ? "border-desk-accent bg-desk-accent/5" : "border-border bg-white"
                      } ${showKey && correct ? "ring-1 ring-desk-accent" : ""}`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        disabled={pending}
                        onChange={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            comprehension: { ...(prev.comprehension || {}), [q.id]: idx },
                          }))
                        }
                      />
                      <span>{choice}</span>
                    </label>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="desk-panel rounded-2xl p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-desk-accent">
          Vocabulary activities
        </h2>
        <ul className="mt-3 space-y-4">
          {(activities.vocabActivities || []).map((a) => (
            <li key={a.id}>
              <p className="font-semibold text-ink">{a.prompt}</p>
              <input
                value={answers.vocab?.[a.id] || ""}
                disabled={pending}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    vocab: { ...(prev.vocab || {}), [a.id]: e.target.value },
                  }))
                }
                className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
                placeholder={a.kind === "use" ? "Your sentence" : "Your answer"}
              />
            </li>
          ))}
        </ul>
      </section>

      {checked ? (
        <p className="text-sm font-semibold text-desk-accent">
          Score check: {score.right}/{score.total || "—"} auto-checkable items
        </p>
      ) : null}
      {msg ? <p className="text-sm font-semibold text-success">{msg}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => persist(false)}
          className="btn-secondary rounded-xl px-4 py-2 text-sm font-bold"
        >
          Save progress
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => persist(true)}
          className="btn-desk rounded-xl px-4 py-2 text-sm font-bold"
        >
          Mark complete
        </button>
      </div>
    </div>
  );
}