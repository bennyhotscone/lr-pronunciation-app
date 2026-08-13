"use client";

import { useState, useTransition } from "react";
import { teacherAddHomework } from "@/lib/portal-actions";
import { teacherCreateGuidedStory } from "@/lib/story/actions";
import { GRAMMAR_FOCUS_OPTIONS, CEFR_LEVELS } from "@/lib/story/types";

function Toggle({
  name,
  label,
  defaultChecked = true,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="rounded border-wood/40"
      />
      {label}
    </label>
  );
}

export function GuidedStoryAssignForm({
  classId,
  studentId,
  students = [],
}: {
  classId?: string;
  studentId?: string;
  students?: { id: string; label: string }[];
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"guided" | "normal">("guided");

  return (
    <section className="card space-y-3 rounded-xl p-4">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
        Homework
      </h2>
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 font-semibold ${
            mode === "guided" ? "bg-desk-accent text-paper" : "border border-wood/30 bg-paper text-ink"
          }`}
          onClick={() => setMode("guided")}
        >
          Guided Story
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 font-semibold ${
            mode === "normal" ? "bg-desk-accent text-paper" : "border border-wood/30 bg-paper text-ink"
          }`}
          onClick={() => setMode("normal")}
        >
          Normal homework
        </button>
      </div>

      {msg ? (
        <p className="rounded-xl bg-desk-accent/10 px-3 py-2 text-sm font-semibold text-ink" role="status">
          {msg}
        </p>
      ) : null}

      {mode === "normal" ? (
        <form
          className="grid gap-3"
          action={(fd) => {
            setMsg(null);
            startTransition(async () => {
              const res = await teacherAddHomework(fd);
              if (res?.error) setMsg(res.error);
              else setMsg("Normal homework assigned.");
            });
          }}
        >
          {classId ? <input type="hidden" name="classId" value={classId} /> : null}
          {studentId ? <input type="hidden" name="studentId" value={studentId} /> : null}
          {!studentId && students.length ? (
            <select
              name="studentId"
              className="rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">Whole class</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} only
                </option>
              ))}
            </select>
          ) : null}
          <input
            name="title"
            required
            placeholder="Title"
            className="rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
          />
          <textarea
            name="instructions"
            required
            rows={3}
            placeholder="Instructions"
            className="rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
          />
          <input
            name="dueAt"
            type="date"
            className="rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-desk-accent px-4 py-2 text-sm font-bold text-paper"
          >
            Assign normal homework
          </button>
        </form>
      ) : (
        <form
          className="grid gap-3"
          action={(fd) => {
            setMsg(null);
            startTransition(async () => {
              const res = await teacherCreateGuidedStory(fd);
              if (res?.error) setMsg(res.error);
              else setMsg("Guided Story homework assigned.");
            });
          }}
        >
          {classId ? <input type="hidden" name="classId" value={classId} /> : null}
          {studentId ? <input type="hidden" name="studentId" value={studentId} /> : null}
          {!studentId && students.length ? (
            <select
              name="studentId"
              className="rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">Whole class</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} only
                </option>
              ))}
            </select>
          ) : null}

          <input
            name="title"
            required
            placeholder="Story title / task name"
            defaultValue="Guided Story"
            className="rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
          />
          <textarea
            name="instructions"
            required
            rows={3}
            placeholder="Instructions for students"
            defaultValue="Plan your story first, then write each section yourself. The guide will not write for you."
            className="rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-semibold text-ink/60">
              Due
              <input
                name="dueAt"
                type="date"
                className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-ink/60">
              Level
              <select
                name="cefrLevel"
                defaultValue="B1"
                className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
              >
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-ink/60">
              Word target
              <input
                name="wordTarget"
                type="number"
                min={80}
                max={2000}
                defaultValue={300}
                className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink/60">
              Min words (optional)
              <input
                name="wordMin"
                type="number"
                className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-ink/60">
              Max words (optional)
              <input
                name="wordMax"
                type="number"
                className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
              />
            </label>
          </div>

          <fieldset className="rounded-xl border border-wood/20 bg-paper/70 p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink/50">
              Grammar focus
            </legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {GRAMMAR_FOCUS_OPTIONS.map((g) => (
                <label key={g} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="grammarFocus" value={g} defaultChecked />
                  {g}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="text-xs font-semibold text-ink/60">
            Required vocabulary (comma or line separated)
            <textarea
              name="vocabList"
              rows={2}
              placeholder="suddenly, although, eventually…"
              className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink/60">
              Min vocab count
              <input
                name="vocabMinCount"
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
              />
            </label>
            <div className="flex items-end pb-1">
              <Toggle name="vocabRequireAll" label="Require all vocab" defaultChecked={false} />
            </div>
          </div>

          <fieldset className="rounded-xl border border-wood/20 bg-paper/70 p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink/50">
              Story requirements
            </legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <Toggle name="requireCharacter" label="Character" />
              <Toggle name="requireSetting" label="Setting" />
              <Toggle name="requireGoal" label="Goal" />
              <Toggle name="requireProblem" label="Problem" />
              <Toggle name="requireChain" label="Story chain" />
              <Toggle name="requireComplication" label="Complication" />
              <Toggle name="requireClimax" label="Climax idea" />
              <Toggle name="requireResolution" label="Resolution" />
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-wood/20 bg-paper/70 p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink/50">
              Guided mode
            </legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <Toggle name="planningRequired" label="Planning required" />
              <Toggle name="storyMapRequired" label="Story map required" />
              <Toggle name="cannotDraftUntilPlanComplete" label="No draft until plan complete" />
              <Toggle name="teacherMustApprovePlan" label="Teacher must approve plan" defaultChecked={false} />
              <Toggle name="revisionRequired" label="Revision passes required" />
              <Toggle name="restrictLargePaste" label="Restrict large paste" />
              <Toggle name="trackProcess" label="Track process metadata" />
              <Toggle name="logicGrammarChecking" label="Logic/grammar checking" />
            </div>
            <label className="mt-2 block text-xs font-semibold text-ink/60">
              Paste threshold (words)
              <input
                name="pasteWordThreshold"
                type="number"
                min={10}
                max={80}
                defaultValue={25}
                className="mt-1 w-full max-w-[8rem] rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm"
              />
            </label>
          </fieldset>

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-desk-accent px-4 py-2 text-sm font-bold text-paper"
          >
            Assign Guided Story
          </button>
        </form>
      )}
    </section>
  );
}
