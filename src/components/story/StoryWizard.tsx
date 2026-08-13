"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  askStoryGuide,
  markStoryMapComplete,
  recordStoryPasteEvent,
  runStoryRevisionPass,
  saveStoryChainEvents,
  saveStoryPlanFields,
  saveStorySection,
  setStoryWizardStep,
  submitStoryAttempt,
} from "@/lib/story/actions";
import {
  buildStoryMapSnapshot,
  canEnterStep,
  enabledSteps,
  wordBudgetGuidance,
  type StoryAssignmentGateConfig,
} from "@/lib/story/state-machine";
import {
  GOAL_TYPE_OPTIONS,
  PROBLEM_TYPE_OPTIONS,
  REVISION_PASS_KINDS,
  countWords,
  stepLabel,
  type StoryCheckIssue,
  type StoryWizardStep,
} from "@/lib/story/types";

type SectionKind = "BEGINNING" | "MIDDLE" | "CLIMAX" | "ENDING";

export type StoryWizardProps = {
  attemptId: string;
  readOnly: boolean;
  assignment: {
    title: string;
    instructions: string;
    wordTarget: number;
    wordMin: number | null;
    wordMax: number | null;
    cefrLevel: string | null;
    grammarFocus: string[];
    vocabList: string[];
    pasteWordThreshold: number;
    restrictLargePaste: boolean;
    teacherMustApprovePlan: boolean;
  } & StoryAssignmentGateConfig;
  initialStep: string;
  status: string;
  planApproval: string;
  studentTitle: string | null;
  studentTopic: string | null;
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
    planComplete: boolean;
    events: { id: string; label: string; cause: string | null; effect: string | null; notes: string | null }[];
  } | null;
  sections: { kind: SectionKind; body: string; wordCount: number }[];
  revisions: { passKind: string; completed: boolean; issues: unknown }[];
  teacherFeedback: string | null;
};

function cfgFromProps(a: StoryWizardProps["assignment"]): StoryAssignmentGateConfig {
  return {
    planningRequired: a.planningRequired,
    storyMapRequired: a.storyMapRequired,
    cannotDraftUntilPlanComplete: a.cannotDraftUntilPlanComplete,
    teacherMustApprovePlan: a.teacherMustApprovePlan,
    revisionRequired: a.revisionRequired,
    requireCharacter: a.requireCharacter,
    requireSetting: a.requireSetting,
    requireGoal: a.requireGoal,
    requireProblem: a.requireProblem,
    requireChain: a.requireChain,
    requireComplication: a.requireComplication,
    requireClimax: a.requireClimax,
    requireResolution: a.requireResolution,
  };
}

export function StoryWizard(props: StoryWizardProps) {
  const cfg = useMemo(() => cfgFromProps(props.assignment), [props.assignment]);
  const steps = useMemo(() => enabledSteps(cfg), [cfg]);
  const [step, setStep] = useState<StoryWizardStep>(
    (steps.includes(props.initialStep as StoryWizardStep)
      ? props.initialStep
      : "ASSIGNMENT") as StoryWizardStep,
  );
  const [plan, setPlan] = useState(props.plan);
  const [events, setEvents] = useState(
    props.plan?.events?.length
      ? props.plan.events.map((e) => ({
          label: e.label,
          cause: e.cause || "",
          effect: e.effect || "",
          notes: e.notes || "",
        }))
      : [
          { label: "Event 1", cause: "", effect: "", notes: "" },
          { label: "Event 2", cause: "", effect: "", notes: "" },
        ],
  );
  const [sections, setSections] = useState<Record<SectionKind, string>>(() => {
    const o: Record<SectionKind, string> = {
      BEGINNING: "",
      MIDDLE: "",
      CLIMAX: "",
      ENDING: "",
    };
    for (const s of props.sections) o[s.kind] = s.body;
    return o;
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideQ, setGuideQ] = useState("");
  const [guideA, setGuideA] = useState<string | null>(null);
  const [planPanelOpen, setPlanPanelOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [revisionIssues, setRevisionIssues] = useState<StoryCheckIssue[] | null>(null);
  const [completedPasses, setCompletedPasses] = useState<string[]>(() =>
    props.revisions.filter((r) => r.completed).map((r) => r.passKind),
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const planGate = useMemo(
    () => ({
      characterName: plan?.characterName,
      characterTraits: plan?.characterTraits,
      characterWant: plan?.characterWant,
      settingPlace: plan?.settingPlace,
      settingTime: plan?.settingTime,
      settingMood: plan?.settingMood,
      goalType: plan?.goalType,
      goalText: plan?.goalText,
      problemType: plan?.problemType,
      problemText: plan?.problemText,
      complicationText: plan?.complicationText,
      climaxIdea: plan?.climaxIdea,
      resolutionText: plan?.resolutionText,
      eventCount: events.filter((e) => e.label.trim()).length,
      planComplete: plan?.planComplete ?? false,
    }),
    [plan, events],
  );

  const attemptGate = useMemo(
    () => ({
      status: props.status,
      planApproval: props.planApproval,
      currentStep: step,
      sectionWordCounts: {
        BEGINNING: countWords(sections.BEGINNING),
        MIDDLE: countWords(sections.MIDDLE),
        CLIMAX: countWords(sections.CLIMAX),
        ENDING: countWords(sections.ENDING),
      },
      revisionPassesCompleted: completedPasses,
    }),
    [props.status, props.planApproval, completedPasses, sections, step],
  );

  const budget = wordBudgetGuidance(props.assignment.wordTarget);
  const readOnly = props.readOnly;

  const goStep = (target: StoryWizardStep) => {
    setMsg(null);
    if (!readOnly) {
      const gate = canEnterStep(target, cfg, planGate, attemptGate);
      if (!gate.ok) {
        setMsg(gate.reason || "Step locked");
        return;
      }
    }
    startTransition(async () => {
      const res = await setStoryWizardStep(props.attemptId, target);
      if (res?.error) setMsg(res.error);
      else setStep(target);
    });
  };

  const schedulePlanSave = useCallback(
    (fields: Record<string, string | null>) => {
      if (readOnly) return;
      setPlan((p) => ({ ...(p || { planComplete: false, events: [] }), ...fields } as typeof plan));
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        startTransition(async () => {
          const res = await saveStoryPlanFields(props.attemptId, fields);
          setSaveState(res?.error ? "idle" : "saved");
          if (res?.error) setMsg(res.error);
        });
      }, 600);
    },
    [props.attemptId, readOnly],
  );

  const scheduleSectionSave = useCallback(
    (kind: SectionKind, body: string) => {
      if (readOnly) return;
      setSections((s) => ({ ...s, [kind]: body }));
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        startTransition(async () => {
          const res = await saveStorySection(props.attemptId, kind, body);
          setSaveState(res?.error ? "idle" : "saved");
          if (res?.error) setMsg(res.error);
        });
      }, 700);
    },
    [props.attemptId, readOnly],
  );

  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const text = e.clipboardData.getData("text") || "";
    const words = countWords(text);
    const threshold = props.assignment.pasteWordThreshold || 25;
    if (words < threshold) return;
    if (props.assignment.restrictLargePaste) {
      e.preventDefault();
      await recordStoryPasteEvent(props.attemptId, words, true);
      setMsg(`Large paste blocked (${words} words). Type your own work — use your plan.`);
    } else {
      await recordStoryPasteEvent(props.attemptId, words, false);
      setMsg(`Large paste attempt: ${words} words (recorded).`);
    }
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const mapPreview = buildStoryMapSnapshot({
    ...planGate,
    events: events.map((e) => ({
      label: e.label,
      cause: e.cause,
      effect: e.effect,
    })),
  });

  const stepIndex = steps.indexOf(step);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/portal" className="text-sm font-semibold text-desk-accent hover:underline">
            ← My Desk
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink sm:text-3xl">
            {props.studentTitle || props.assignment.title}
          </h1>
          <p className="mt-1 text-sm text-ink/55">
            Guided Story Writer
            {props.assignment.cefrLevel ? ` · ${props.assignment.cefrLevel}` : ""}
            {readOnly ? " · submitted (read-only)" : ""}
          </p>
        </div>
        <p className="text-xs font-semibold text-ink/45" aria-live="polite">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
        </p>
      </div>

      {msg ? (
        <p className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-ink" role="status">
          {msg}
        </p>
      ) : null}

      {props.planApproval === "PENDING" && props.assignment.teacherMustApprovePlan ? (
        <p className="rounded-xl border border-desk-accent/30 bg-desk-accent/10 px-3 py-2 text-sm text-ink">
          Plan submitted for teacher approval — drafting stays locked until approved.
        </p>
      ) : null}
      {props.planApproval === "CHANGES_REQUESTED" ? (
        <p className="rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-ink">
          Teacher requested plan changes.
          {props.teacherFeedback ? ` Note: ${props.teacherFeedback}` : ""}
        </p>
      ) : null}

      {/* Step rail */}
      <nav aria-label="Story steps" className="overflow-x-auto">
        <ol className="flex min-w-max gap-1 pb-1">
          {steps.map((s, i) => {
            const locked =
              !readOnly && !canEnterStep(s, cfg, planGate, attemptGate).ok && s !== step;
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={pending || (locked && !readOnly)}
                  onClick={() => goStep(s)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                    s === step
                      ? "bg-desk-accent text-paper"
                      : locked
                        ? "bg-wood/10 text-ink/35"
                        : "bg-paper text-ink ring-1 ring-wood/20"
                  }`}
                >
                  {i + 1}. {stepLabel(s)}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="desk-panel space-y-4 rounded-2xl p-4 sm:p-5">
          {/* ASSIGNMENT */}
          {step === "ASSIGNMENT" ? (
            <div className="space-y-3 text-sm text-ink/80">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
                Assignment
              </h2>
              <p className="whitespace-pre-wrap">{props.assignment.instructions}</p>
              <ul className="list-disc space-y-1 pl-5 text-ink/70">
                <li>{budget.tip}</li>
                {props.assignment.grammarFocus.length ? (
                  <li>Grammar focus: {props.assignment.grammarFocus.join(", ")}</li>
                ) : null}
                {props.assignment.vocabList.length ? (
                  <li>Vocabulary: {props.assignment.vocabList.join(", ")}</li>
                ) : null}
                {props.studentTopic ? <li>Your topic: {props.studentTopic}</li> : null}
              </ul>
              <p className="rounded-xl bg-paper/80 px-3 py-2 text-xs text-ink/55">
                The Story Guide asks questions only. It will never write your story for you.
              </p>
            </div>
          ) : null}

          {/* CHARACTER */}
          {step === "CHARACTER" ? (
            <PlanFields
              title="Character"
              readOnly={readOnly}
              fields={[
                {
                  key: "characterName",
                  label: "Name",
                  value: plan?.characterName || "",
                },
                {
                  key: "characterTraits",
                  label: "Traits (your words)",
                  value: plan?.characterTraits || "",
                  rows: 2,
                },
                {
                  key: "characterWant",
                  label: "What do they want?",
                  value: plan?.characterWant || "",
                  rows: 2,
                },
              ]}
              onChange={schedulePlanSave}
              onPaste={onPaste}
            />
          ) : null}

          {step === "SETTING" ? (
            <PlanFields
              title="Setting"
              readOnly={readOnly}
              fields={[
                { key: "settingPlace", label: "Place", value: plan?.settingPlace || "" },
                { key: "settingTime", label: "Time", value: plan?.settingTime || "" },
                {
                  key: "settingMood",
                  label: "Mood / atmosphere",
                  value: plan?.settingMood || "",
                },
              ]}
              onChange={schedulePlanSave}
              onPaste={onPaste}
            />
          ) : null}

          {step === "GOAL" ? (
            <CategoryPlanStep
              title="Goal"
              typeLabel="Goal type (category only)"
              typeOptions={GOAL_TYPE_OPTIONS}
              typeValue={plan?.goalType || ""}
              typeKey="goalType"
              detailKey="goalText"
              detailLabel="Describe the goal in your own words"
              detailValue={plan?.goalText || ""}
              readOnly={readOnly}
              onChange={schedulePlanSave}
              onPaste={onPaste}
            />
          ) : null}

          {step === "PROBLEM" ? (
            <CategoryPlanStep
              title="Problem"
              typeLabel="Problem type (category only)"
              typeOptions={PROBLEM_TYPE_OPTIONS}
              typeValue={plan?.problemType || ""}
              typeKey="problemType"
              detailKey="problemText"
              detailLabel="Describe the problem in your own words"
              detailValue={plan?.problemText || ""}
              readOnly={readOnly}
              onChange={schedulePlanSave}
              onPaste={onPaste}
            />
          ) : null}

          {step === "STORY_CHAIN" ? (
            <div className="space-y-3">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
                Story Chain
              </h2>
              <p className="text-sm text-ink/60">
                Add events and cause → effect. Gaps become questions — the app will not invent
                connections.
              </p>
              {events.map((ev, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-wood/20 bg-paper/80 p-3 space-y-2"
                >
                  <input
                    disabled={readOnly}
                    value={ev.label}
                    onChange={(e) => {
                      const next = events.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      );
                      setEvents(next);
                    }}
                    onBlur={() => {
                      if (readOnly) return;
                      startTransition(async () => {
                        await saveStoryChainEvents(props.attemptId, events);
                        setSaveState("saved");
                      });
                    }}
                    className="w-full rounded-lg border border-wood/30 px-2 py-1.5 text-sm font-semibold"
                    placeholder={`Event ${i + 1}`}
                  />
                  <textarea
                    disabled={readOnly}
                    value={ev.cause}
                    onPaste={onPaste}
                    onChange={(e) => {
                      const next = events.map((x, j) =>
                        j === i ? { ...x, cause: e.target.value } : x,
                      );
                      setEvents(next);
                    }}
                    onBlur={() => {
                      if (readOnly) return;
                      startTransition(async () => {
                        await saveStoryChainEvents(props.attemptId, events);
                      });
                    }}
                    rows={2}
                    placeholder="Cause…"
                    className="w-full rounded-lg border border-wood/30 px-2 py-1.5 text-sm"
                  />
                  <textarea
                    disabled={readOnly}
                    value={ev.effect}
                    onPaste={onPaste}
                    onChange={(e) => {
                      const next = events.map((x, j) =>
                        j === i ? { ...x, effect: e.target.value } : x,
                      );
                      setEvents(next);
                    }}
                    onBlur={() => {
                      if (readOnly) return;
                      startTransition(async () => {
                        await saveStoryChainEvents(props.attemptId, events);
                      });
                    }}
                    rows={2}
                    placeholder="Effect…"
                    className="w-full rounded-lg border border-wood/30 px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
              {!readOnly ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-wood/30 bg-paper px-3 py-1.5 text-sm font-semibold"
                    onClick={() =>
                      setEvents((e) => [
                        ...e,
                        { label: `Event ${e.length + 1}`, cause: "", effect: "", notes: "" },
                      ])
                    }
                  >
                    Add event
                  </button>
                  {events.length > 2 ? (
                    <button
                      type="button"
                      className="rounded-lg border border-wood/30 bg-paper px-3 py-1.5 text-sm font-semibold"
                      onClick={() => setEvents((e) => e.slice(0, -1))}
                    >
                      Remove last
                    </button>
                  ) : null}
                </div>
              ) : null}
              {mapPreview.gapQuestions.filter((q) => q.toLowerCase().includes("event")).length ? (
                <ul className="list-disc pl-5 text-sm text-ink/60">
                  {mapPreview.gapQuestions
                    .filter((q) => /event|lead/i.test(q))
                    .map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {step === "COMPLICATION" ? (
            <PlanFields
              title="Complication"
              readOnly={readOnly}
              fields={[
                {
                  key: "complicationText",
                  label: "What makes things harder? (your idea)",
                  value: plan?.complicationText || "",
                  rows: 4,
                },
              ]}
              onChange={schedulePlanSave}
              onPaste={onPaste}
            />
          ) : null}

          {step === "CLIMAX" ? (
            <PlanFields
              title="Climax idea"
              readOnly={readOnly}
              fields={[
                {
                  key: "climaxIdea",
                  label: "Most intense moment (notes only — not the paragraph yet)",
                  value: plan?.climaxIdea || "",
                  rows: 4,
                },
              ]}
              onChange={schedulePlanSave}
              onPaste={onPaste}
            />
          ) : null}

          {step === "RESOLUTION" ? (
            <PlanFields
              title="Resolution"
              readOnly={readOnly}
              fields={[
                {
                  key: "resolutionText",
                  label: "How does it end / resolve?",
                  value: plan?.resolutionText || "",
                  rows: 4,
                },
              ]}
              onChange={schedulePlanSave}
              onPaste={onPaste}
            />
          ) : null}

          {step === "STORY_MAP" ? (
            <div className="space-y-3">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
                Story Map
              </h2>
              <p className="text-sm text-ink/60">
                Organised from your inputs only — nothing invented or polished.
              </p>
              <dl className="space-y-2 text-sm">
                <MapRow label="Character" value={mapPreview.character} />
                <MapRow label="Setting" value={mapPreview.setting} />
                <MapRow label="Goal" value={mapPreview.goal} />
                <MapRow label="Problem" value={mapPreview.problem} />
                <div>
                  <dt className="text-xs font-bold uppercase text-ink/45">Events</dt>
                  <dd className="mt-1 space-y-1">
                    {mapPreview.events.map((e, i) => (
                      <p key={i} className="rounded-lg bg-paper/80 px-2 py-1.5">
                        <strong>{e.label}</strong>
                        {e.cause ? ` ← ${e.cause}` : ""}
                        {e.effect ? ` → ${e.effect}` : ""}
                      </p>
                    ))}
                  </dd>
                </div>
                <MapRow label="Complication" value={mapPreview.complication} />
                <MapRow label="Climax" value={mapPreview.climax} />
                <MapRow label="Resolution" value={mapPreview.resolution} />
              </dl>
              {mapPreview.gapQuestions.length ? (
                <div className="rounded-xl border border-amber/30 bg-amber/10 p-3">
                  <p className="text-xs font-bold uppercase text-ink/50">Questions (not answers)</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-ink/75">
                    {mapPreview.gapQuestions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-desk-accent">Plan looks complete enough to draft.</p>
              )}
              {!readOnly && !plan?.planComplete ? (
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-xl bg-desk-accent px-4 py-2 text-sm font-bold text-paper disabled:opacity-50"
                  onClick={() => {
                    startTransition(async () => {
                      await saveStoryChainEvents(props.attemptId, events);
                      const res = await markStoryMapComplete(props.attemptId);
                      if (res?.error) setMsg(res.error);
                      else {
                        setPlan((p) => (p ? { ...p, planComplete: true } : p));
                        setMsg("Story Map marked complete.");
                      }
                    });
                  }}
                >
                  Mark plan complete
                </button>
              ) : null}
              {plan?.planComplete ? (
                <p className="text-sm font-semibold text-desk-accent">Plan marked complete.</p>
              ) : null}
            </div>
          ) : null}

          {step === "BEGINNING" ||
          step === "MIDDLE" ||
          step === "CLIMAX_PARAGRAPH" ||
          step === "ENDING" ? (
            <DraftStep
              step={step}
              kind={
                step === "BEGINNING"
                  ? "BEGINNING"
                  : step === "MIDDLE"
                    ? "MIDDLE"
                    : step === "ENDING"
                      ? "ENDING"
                      : "CLIMAX"
              }
              body={
                step === "BEGINNING"
                  ? sections.BEGINNING
                  : step === "MIDDLE"
                    ? sections.MIDDLE
                    : step === "ENDING"
                      ? sections.ENDING
                      : sections.CLIMAX
              }
              guideWords={
                step === "BEGINNING"
                  ? budget.beginning
                  : step === "MIDDLE"
                    ? budget.middle
                    : step === "ENDING"
                      ? budget.ending
                      : budget.climax
              }
              readOnly={readOnly}
              mapPreview={mapPreview}
              planPanelOpen={planPanelOpen}
              setPlanPanelOpen={setPlanPanelOpen}
              onChange={scheduleSectionSave}
              onPaste={onPaste}
            />
          ) : null}

          {step === "REVIEW" ? (
            <div className="space-y-4">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
                Revision passes
              </h2>
              <p className="text-sm text-ink/60">
                Checks flag issues as questions. Nothing rewrites your story.
              </p>
              <div className="flex flex-wrap gap-2">
                {REVISION_PASS_KINDS.map((pass) => {
                  const done = completedPasses.includes(pass);
                  return (
                    <button
                      key={pass}
                      type="button"
                      disabled={readOnly || pending}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                        done
                          ? "bg-desk-accent/15 text-desk-accent ring-1 ring-desk-accent/30"
                          : "bg-paper ring-1 ring-wood/25"
                      }`}
                      onClick={() => {
                        startTransition(async () => {
                          const res = await runStoryRevisionPass(props.attemptId, pass);
                          if (res?.error) setMsg(res.error);
                          else {
                            setCompletedPasses((prev) =>
                              prev.includes(pass) ? prev : [...prev, pass],
                            );
                            setRevisionIssues((res.issues as StoryCheckIssue[]) || []);
                            setMsg(`${pass} pass recorded.`);
                          }
                        });
                      }}
                    >
                      {pass}
                      {done ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
              {revisionIssues ? (
                <ul className="space-y-2 text-sm">
                  {revisionIssues.map((iss, i) => (
                    <li key={`${iss.code}-${i}`} className="rounded-lg bg-paper/80 px-3 py-2">
                      <span className="font-semibold">{iss.message}</span>
                      {iss.hint ? <p className="text-ink/55">{iss.hint}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <FullDraftPreview sections={sections} />
            </div>
          ) : null}

          {step === "SUBMIT" ? (
            <div className="space-y-3">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
                Submit
              </h2>
              <FullDraftPreview sections={sections} />
              <p className="text-sm text-ink/60">
                Total ~{countWords(
                  `${sections.BEGINNING} ${sections.MIDDLE} ${sections.CLIMAX} ${sections.ENDING}`,
                )}{" "}
                words (target {props.assignment.wordTarget}).
              </p>
              {!readOnly ? (
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-xl bg-desk-accent px-4 py-2.5 text-sm font-bold text-paper"
                  onClick={() => {
                    startTransition(async () => {
                      const res = await submitStoryAttempt(props.attemptId);
                      if (res?.error) setMsg(res.error);
                      else {
                        setMsg("Submitted. Your work is now read-only.");
                        window.location.reload();
                      }
                    });
                  }}
                >
                  Submit story
                </button>
              ) : (
                <p className="font-semibold text-desk-accent">Already submitted.</p>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2 border-t border-wood/15 pt-3">
            <button
              type="button"
              className="rounded-lg border border-wood/30 bg-paper px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
              disabled={stepIndex <= 0 || pending}
              onClick={() => {
                const prev = steps[stepIndex - 1];
                if (prev) goStep(prev);
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-lg bg-desk-accent px-3 py-1.5 text-sm font-bold text-paper disabled:opacity-40"
              disabled={stepIndex >= steps.length - 1 || pending}
              onClick={() => {
                const next = steps[stepIndex + 1];
                if (next) goStep(next);
              }}
            >
              Next
            </button>
          </div>
        </div>

        {/* Story Guide panel — small workbook guide */}
        <aside className="desk-panel h-fit rounded-2xl p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setGuideOpen((o) => !o)}
          >
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
              Story Guide
            </h2>
            <span className="text-xs text-ink/45">{guideOpen ? "Hide" : "Show"}</span>
          </button>
          {guideOpen ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-ink/55">
                Questions only. Never writes your story.
              </p>
              <textarea
                value={guideQ}
                onChange={(e) => setGuideQ(e.target.value)}
                rows={3}
                placeholder="Ask for a planning question…"
                className="w-full rounded-lg border border-wood/30 bg-paper px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={pending || !guideQ.trim()}
                className="rounded-lg bg-desk-accent/90 px-3 py-1.5 text-xs font-bold text-paper"
                onClick={() => {
                  startTransition(async () => {
                    const res = await askStoryGuide(props.attemptId, guideQ);
                    if (res?.error) setGuideA(res.error);
                    else setGuideA(res.text || null);
                  });
                }}
              >
                Ask
              </button>
              {guideA ? (
                <p className="rounded-lg bg-paper/90 px-2 py-2 text-sm text-ink/80">{guideA}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink/50">
              Stuck? Open for scaffolding questions — not answers.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function MapRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase text-ink/45">{label}</dt>
      <dd className="mt-0.5 rounded-lg bg-paper/80 px-2 py-1.5 text-ink/80">
        {value || <span className="text-ink/35">—</span>}
      </dd>
    </div>
  );
}

function PlanFields({
  title,
  fields,
  readOnly,
  onChange,
  onPaste,
}: {
  title: string;
  fields: { key: string; label: string; value: string; rows?: number }[];
  readOnly: boolean;
  onChange: (fields: Record<string, string | null>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
        {title}
      </h2>
      {fields.map((f) => (
        <label key={f.key} className="block text-sm font-semibold text-ink/70">
          {f.label}
          {f.rows && f.rows > 1 ? (
            <textarea
              disabled={readOnly}
              defaultValue={f.value}
              rows={f.rows}
              onPaste={onPaste}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
              className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm font-normal"
            />
          ) : (
            <input
              disabled={readOnly}
              defaultValue={f.value}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
              className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm font-normal"
            />
          )}
        </label>
      ))}
    </div>
  );
}

function CategoryPlanStep({
  title,
  typeLabel,
  typeOptions,
  typeValue,
  typeKey,
  detailKey,
  detailLabel,
  detailValue,
  readOnly,
  onChange,
  onPaste,
}: {
  title: string;
  typeLabel: string;
  typeOptions: readonly string[];
  typeValue: string;
  typeKey: string;
  detailKey: string;
  detailLabel: string;
  detailValue: string;
  readOnly: boolean;
  onChange: (fields: Record<string, string | null>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
        {title}
      </h2>
      <p className="text-xs text-ink/55">{typeLabel} — buttons never invent your plot.</p>
      <div className="flex flex-wrap gap-2">
        {typeOptions.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={readOnly}
            onClick={() => onChange({ [typeKey]: opt })}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              typeValue === opt
                ? "bg-desk-accent text-paper"
                : "bg-paper ring-1 ring-wood/25 text-ink"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <label className="block text-sm font-semibold text-ink/70">
        {detailLabel}
        <textarea
          disabled={readOnly}
          defaultValue={detailValue}
          rows={4}
          onPaste={onPaste}
          onChange={(e) => onChange({ [detailKey]: e.target.value })}
          className="mt-1 w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm font-normal"
        />
      </label>
    </div>
  );
}

function DraftStep({
  step,
  kind,
  body,
  guideWords,
  readOnly,
  mapPreview,
  planPanelOpen,
  setPlanPanelOpen,
  onChange,
  onPaste,
}: {
  step: StoryWizardStep;
  kind: SectionKind;
  body: string;
  guideWords: number;
  readOnly: boolean;
  mapPreview: ReturnType<typeof buildStoryMapSnapshot>;
  planPanelOpen: boolean;
  setPlanPanelOpen: (v: boolean) => void;
  onChange: (kind: SectionKind, body: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
          {stepLabel(step)}
        </h2>
        <p className="text-xs text-ink/50">
          ~{countWords(body)} words · aim ~{guideWords}
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <textarea
            disabled={readOnly}
            value={body}
            onPaste={onPaste}
            onChange={(e) => onChange(kind, e.target.value)}
            rows={14}
            placeholder="Write this section yourself using your plan…"
            className="w-full rounded-xl border border-wood/30 bg-paper px-3 py-2 text-sm leading-relaxed"
          />
        </div>
        <div className="order-1 lg:order-2">
          <button
            type="button"
            className="mb-2 text-xs font-bold text-desk-accent lg:hidden"
            onClick={() => setPlanPanelOpen(!planPanelOpen)}
          >
            {planPanelOpen ? "Hide plan" : "Show plan"}
          </button>
          <div className={`${planPanelOpen ? "block" : "hidden"} lg:block`}>
            <p className="text-xs font-bold uppercase text-ink/45">Your plan</p>
            <div className="mt-2 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-wood/15 bg-paper/70 p-3 text-sm">
              <MapRow label="Character" value={mapPreview.character} />
              <MapRow label="Setting" value={mapPreview.setting} />
              <MapRow label="Goal" value={mapPreview.goal} />
              <MapRow label="Problem" value={mapPreview.problem} />
              <MapRow label="Climax idea" value={mapPreview.climax} />
              <MapRow label="Resolution" value={mapPreview.resolution} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FullDraftPreview({
  sections,
}: {
  sections: Record<SectionKind, string>;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-wood/15 bg-paper/70 p-3 text-sm leading-relaxed text-ink/85">
      {(["BEGINNING", "MIDDLE", "CLIMAX", "ENDING"] as const).map((k) => (
        <div key={k}>
          <p className="text-xs font-bold uppercase text-ink/45">{k}</p>
          <p className="mt-1 whitespace-pre-wrap">{sections[k] || "—"}</p>
        </div>
      ))}
    </div>
  );
}
