"use server";

import { prisma } from "@/lib/db";
import { assertTeacherOwnsClass, isStaff } from "@/lib/portal-access";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  assertStudentOwnsAttempt,
  assertTeacherCanReviewAttempt,
  loadStoryAttemptBundle,
  studentCanAccessAssignment,
} from "./access";
import {
  buildStoryMapSnapshot,
  canEnterStep,
  enabledSteps,
  isPlanningBundleComplete,
  type StoryAssignmentGateConfig,
  type StoryAttemptGateState,
  type StoryPlanGateState,
} from "./state-machine";
import {
  countWords,
  isStoryWizardStep,
  REVISION_PASS_KINDS,
  type StoryWizardStep,
} from "./types";
import {
  issuesForRevisionPass,
  runDeterministicStoryChecks,
} from "./checks";
import { optionalAiStoryIssues, optionalStoryGuideReply } from "./ai-check";
import { refuseGhostwritingRequest } from "./ghostwriting";

function gateConfig(a: {
  planningRequired: boolean;
  storyMapRequired: boolean;
  cannotDraftUntilPlanComplete: boolean;
  teacherMustApprovePlan: boolean;
  revisionRequired: boolean;
  requireCharacter: boolean;
  requireSetting: boolean;
  requireGoal: boolean;
  requireProblem: boolean;
  requireChain: boolean;
  requireComplication: boolean;
  requireClimax: boolean;
  requireResolution: boolean;
}): StoryAssignmentGateConfig {
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

function planGate(plan: {
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
  events?: { id: string }[];
} | null): StoryPlanGateState {
  return {
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
    eventCount: plan?.events?.length ?? 0,
    planComplete: plan?.planComplete ?? false,
  };
}

function attemptGate(attempt: {
  status: string;
  planApproval: string;
  currentStep: string;
  sections: { kind: string; wordCount: number }[];
  revisions: { passKind: string; completed: boolean }[];
}): StoryAttemptGateState {
  const sectionWordCounts: StoryAttemptGateState["sectionWordCounts"] = {};
  for (const s of attempt.sections) {
    if (s.kind === "BEGINNING" || s.kind === "MIDDLE" || s.kind === "CLIMAX" || s.kind === "ENDING") {
      sectionWordCounts[s.kind] = s.wordCount;
    }
  }
  return {
    status: attempt.status,
    planApproval: attempt.planApproval,
    currentStep: attempt.currentStep,
    sectionWordCounts,
    revisionPassesCompleted: attempt.revisions.filter((r) => r.completed).map((r) => r.passKind),
  };
}

function parseVocabList(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function parseBool(fd: FormData, key: string, defaultValue = false): boolean {
  const v = fd.get(key);
  if (v == null || v === "") return defaultValue;
  return v === "on" || v === "true" || v === "1";
}

function parseIntOrNull(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/** Teacher: create Guided Story homework (Mode B) + optional normal homework link. */
export async function teacherCreateGuidedStory(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) {
    return { error: "Unauthorized" };
  }

  const title = String(formData.get("title") || "").trim();
  const instructions = String(formData.get("instructions") || "").trim();
  const classId = String(formData.get("classId") || "") || null;
  const studentId = String(formData.get("studentId") || "") || null;
  const dueRaw = String(formData.get("dueAt") || "");
  const cefrLevel = String(formData.get("cefrLevel") || "").trim() || null;
  const wordTarget = parseIntOrNull(String(formData.get("wordTarget") || "300")) || 300;
  const wordMin = parseIntOrNull(String(formData.get("wordMin") || ""));
  const wordMax = parseIntOrNull(String(formData.get("wordMax") || ""));
  const vocabList = parseVocabList(String(formData.get("vocabList") || ""));
  const vocabMinCount = parseIntOrNull(String(formData.get("vocabMinCount") || ""));
  const grammarFocus = formData
    .getAll("grammarFocus")
    .map((v) => String(v).trim())
    .filter(Boolean);

  if (!title || !instructions) return { error: "Title and instructions are required." };
  if (!classId && !studentId) return { error: "Assign to a class or a student." };
  if (classId) await assertTeacherOwnsClass(session.user.id, classId, session.user.role);

  const teacherMustApprovePlan = parseBool(formData, "teacherMustApprovePlan");
  const cfg = {
    requireCharacter: parseBool(formData, "requireCharacter", true),
    requireSetting: parseBool(formData, "requireSetting", true),
    requireGoal: parseBool(formData, "requireGoal", true),
    requireProblem: parseBool(formData, "requireProblem", true),
    requireChain: parseBool(formData, "requireChain", true),
    requireComplication: parseBool(formData, "requireComplication", true),
    requireClimax: parseBool(formData, "requireClimax", true),
    requireResolution: parseBool(formData, "requireResolution", true),
    planningRequired: parseBool(formData, "planningRequired", true),
    storyMapRequired: parseBool(formData, "storyMapRequired", true),
    cannotDraftUntilPlanComplete: parseBool(formData, "cannotDraftUntilPlanComplete", true),
    teacherMustApprovePlan,
    revisionRequired: parseBool(formData, "revisionRequired", true),
    restrictLargePaste: parseBool(formData, "restrictLargePaste", true),
    trackProcess: parseBool(formData, "trackProcess", true),
    logicGrammarChecking: parseBool(formData, "logicGrammarChecking", true),
    pasteWordThreshold: parseIntOrNull(String(formData.get("pasteWordThreshold") || "")) || 25,
    vocabRequireAll: parseBool(formData, "vocabRequireAll"),
  };

  const homework = await prisma.homework.create({
    data: {
      title,
      instructions,
      dueAt: dueRaw ? new Date(dueRaw) : null,
      classId,
      studentId,
      createdById: session.user.id,
    },
  });

  const assignment = await prisma.storyAssignment.create({
    data: {
      homeworkId: homework.id,
      classId,
      studentId,
      createdById: session.user.id,
      title,
      instructions,
      dueAt: dueRaw ? new Date(dueRaw) : null,
      wordTarget,
      wordMin,
      wordMax,
      cefrLevel,
      grammarFocus,
      vocabList,
      vocabMinCount,
      isFreePractice: false,
      ...cfg,
    },
  });

  if (classId) revalidatePath(`/teacher/classes/${classId}`);
  if (studentId) revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/portal");
  return { ok: true as const, assignmentId: assignment.id, homeworkId: homework.id };
}

/** Student: open homework-linked attempt (get or create). */
export async function openStoryAttemptForHomework(homeworkId: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const assignment = await prisma.storyAssignment.findUnique({
    where: { homeworkId },
  });
  if (!assignment) return { error: "Not a Guided Story assignment." };
  const allowed = await studentCanAccessAssignment(session.user.id, assignment.id);
  if (!allowed) return { error: "Forbidden" };

  const attempt = await prisma.storyAttempt.upsert({
    where: {
      assignmentId_studentId: {
        assignmentId: assignment.id,
        studentId: session.user.id,
      },
    },
    create: {
      assignmentId: assignment.id,
      studentId: session.user.id,
      status: "PLANNING",
      planApproval: assignment.teacherMustApprovePlan ? "PENDING" : "NOT_REQUIRED",
      currentStep: "ASSIGNMENT",
      plan: { create: {} },
    },
    update: {},
  });

  // Ensure plan row exists for older attempts
  await prisma.storyPlan.upsert({
    where: { attemptId: attempt.id },
    create: { attemptId: attempt.id },
    update: {},
  });

  return { ok: true as const, attemptId: attempt.id };
}

/** Mode A — Free Story Practice from My Desk. */
export async function startFreeStoryPractice(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const cefrLevel = String(formData.get("cefrLevel") || "B1").trim() || "B1";
  const wordTarget = parseIntOrNull(String(formData.get("wordTarget") || "200")) || 200;
  const grammarFocus = formData
    .getAll("grammarFocus")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const studentTitle = String(formData.get("title") || "").trim() || null;
  const studentTopic = String(formData.get("topic") || "").trim() || null;

  const assignment = await prisma.storyAssignment.create({
    data: {
      createdById: session.user.id,
      title: studentTitle || "Free Story Practice",
      instructions:
        "Practice planning and writing your own story. The guide will not write for you.",
      wordTarget,
      wordMin: Math.round(wordTarget * 0.7),
      wordMax: Math.round(wordTarget * 1.4),
      cefrLevel,
      grammarFocus,
      isFreePractice: true,
      teacherMustApprovePlan: false,
      planningRequired: true,
      storyMapRequired: true,
      cannotDraftUntilPlanComplete: true,
      revisionRequired: true,
      restrictLargePaste: true,
      trackProcess: true,
      logicGrammarChecking: true,
    },
  });

  const attempt = await prisma.storyAttempt.create({
    data: {
      assignmentId: assignment.id,
      studentId: session.user.id,
      status: "PLANNING",
      planApproval: "NOT_REQUIRED",
      currentStep: "ASSIGNMENT",
      studentTitle,
      studentTopic,
      plan: { create: {} },
    },
  });

  revalidatePath("/portal");
  return { ok: true as const, attemptId: attempt.id };
}

export async function setStoryWizardStep(attemptId: string, step: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const attempt = await assertStudentOwnsAttempt(attemptId, session.user.id);
  if (!attempt) return { error: "Not found" };
  if (attempt.status === "SUBMITTED" || attempt.status === "REVIEWED") {
    // Allow navigation while read-only
    if (!isStoryWizardStep(step)) return { error: "Invalid step" };
    await prisma.storyAttempt.update({
      where: { id: attemptId },
      data: { currentStep: step },
    });
    return { ok: true as const };
  }
  if (!isStoryWizardStep(step)) return { error: "Invalid step" };
  const cfg = gateConfig(attempt.assignment);
  const gate = canEnterStep(step, cfg, planGate(attempt.plan), attemptGate(attempt));
  if (!gate.ok) return { error: gate.reason || "Step locked" };

  await prisma.storyAttempt.update({
    where: { id: attemptId },
    data: { currentStep: step },
  });
  if (attempt.assignment.trackProcess) {
    await prisma.storyIntegrityEvent.create({
      data: {
        attemptId,
        kind: "STEP_ENTERED",
        meta: { step },
      },
    });
  }
  return { ok: true as const };
}

export async function saveStoryPlanFields(
  attemptId: string,
  fields: Record<string, string | null>,
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const attempt = await assertStudentOwnsAttempt(attemptId, session.user.id);
  if (!attempt) return { error: "Not found" };
  if (attempt.status === "SUBMITTED" || attempt.status === "REVIEWED") {
    return { error: "Submitted work is read-only." };
  }

  const allowed = [
    "characterName",
    "characterTraits",
    "characterWant",
    "settingPlace",
    "settingTime",
    "settingMood",
    "goalType",
    "goalText",
    "problemType",
    "problemText",
    "complicationText",
    "climaxIdea",
    "resolutionText",
  ] as const;

  const data: Record<string, string | null> = {};
  for (const key of allowed) {
    if (key in fields) {
      const v = fields[key];
      data[key] = v == null ? null : String(v).slice(0, 2000);
    }
  }

  await prisma.storyPlan.upsert({
    where: { attemptId },
    create: { attemptId, ...data },
    update: data,
  });

  if (attempt.assignment.trackProcess) {
    await prisma.storyIntegrityEvent.create({
      data: { attemptId, kind: "AUTOSAVE", meta: { scope: "plan" } },
    });
  }
  revalidatePath(`/portal/stories/${attemptId}`);
  return { ok: true as const };
}

export async function saveStoryChainEvents(
  attemptId: string,
  events: { id?: string; label: string; cause?: string; effect?: string; notes?: string }[],
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const attempt = await assertStudentOwnsAttempt(attemptId, session.user.id);
  if (!attempt) return { error: "Not found" };
  if (attempt.status === "SUBMITTED" || attempt.status === "REVIEWED") {
    return { error: "Submitted work is read-only." };
  }

  const plan =
    attempt.plan ||
    (await prisma.storyPlan.create({ data: { attemptId } }));

  await prisma.storyPlanEvent.deleteMany({ where: { planId: plan.id } });
  const cleaned = events
    .map((e, i) => ({
      planId: plan.id,
      sortOrder: i,
      label: String(e.label || `Event ${i + 1}`).slice(0, 200),
      cause: e.cause ? String(e.cause).slice(0, 1000) : null,
      effect: e.effect ? String(e.effect).slice(0, 1000) : null,
      notes: e.notes ? String(e.notes).slice(0, 1000) : null,
    }))
    .slice(0, 12);

  if (cleaned.length) {
    await prisma.storyPlanEvent.createMany({ data: cleaned });
  }

  revalidatePath(`/portal/stories/${attemptId}`);
  return { ok: true as const };
}

export async function markStoryMapComplete(attemptId: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const attempt = await assertStudentOwnsAttempt(attemptId, session.user.id);
  if (!attempt) return { error: "Not found" };
  if (attempt.status === "SUBMITTED" || attempt.status === "REVIEWED") {
    return { error: "Submitted work is read-only." };
  }

  const cfg = gateConfig(attempt.assignment);
  const pg = planGate(attempt.plan);
  // Allow marking map complete when required plan *fields* are filled (planComplete is what we're setting).
  const fieldsReady = (() => {
    const withoutMap = { ...cfg, storyMapRequired: false };
    return isPlanningBundleComplete({ ...pg, planComplete: true }, withoutMap);
  })();
  if (!fieldsReady) {
    return { error: "Finish required planning steps before marking the Story Map complete." };
  }

  const events =
    attempt.plan?.events.map((e) => ({
      label: e.label,
      cause: e.cause,
      effect: e.effect,
    })) || [];
  const mapSnapshot = buildStoryMapSnapshot({ ...pg, events });

  await prisma.storyPlan.update({
    where: { attemptId },
    data: {
      planComplete: true,
      completedAt: new Date(),
      mapSnapshot,
    },
  });

  // If teacher approval required, keep PENDING (or set PENDING if was NOT_REQUIRED wrongly)
  if (attempt.assignment.teacherMustApprovePlan && attempt.planApproval === "NOT_REQUIRED") {
    await prisma.storyAttempt.update({
      where: { id: attemptId },
      data: { planApproval: "PENDING", status: "AWAITING_PLAN_APPROVAL" },
    });
  } else if (
    attempt.assignment.teacherMustApprovePlan &&
    attempt.planApproval === "PENDING"
  ) {
    await prisma.storyAttempt.update({
      where: { id: attemptId },
      data: { status: "AWAITING_PLAN_APPROVAL" },
    });
  } else if (!attempt.assignment.teacherMustApprovePlan) {
    await prisma.storyAttempt.update({
      where: { id: attemptId },
      data: { status: "DRAFTING" },
    });
  }

  revalidatePath(`/portal/stories/${attemptId}`);
  revalidatePath("/teacher");
  return { ok: true as const, mapSnapshot };
}

export async function saveStorySection(
  attemptId: string,
  kind: "BEGINNING" | "MIDDLE" | "CLIMAX" | "ENDING",
  body: string,
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const attempt = await assertStudentOwnsAttempt(attemptId, session.user.id);
  if (!attempt) return { error: "Not found" };
  if (attempt.status === "SUBMITTED" || attempt.status === "REVIEWED") {
    return { error: "Submitted work is read-only." };
  }

  const stepMap: Record<typeof kind, StoryWizardStep> = {
    BEGINNING: "BEGINNING",
    MIDDLE: "MIDDLE",
    CLIMAX: "CLIMAX_PARAGRAPH",
    ENDING: "ENDING",
  };
  const cfg = gateConfig(attempt.assignment);
  const gate = canEnterStep(stepMap[kind], cfg, planGate(attempt.plan), attemptGate(attempt));
  if (!gate.ok) return { error: gate.reason || "Drafting locked" };

  const text = String(body || "").slice(0, 12000);
  const wordCount = countWords(text);
  await prisma.storyDraftSection.upsert({
    where: { attemptId_kind: { attemptId, kind } },
    create: { attemptId, kind, body: text, wordCount },
    update: { body: text, wordCount },
  });

  if (attempt.status === "PLANNING" || attempt.status === "AWAITING_PLAN_APPROVAL") {
    // Should not happen if gate works; keep status if drafting allowed
  } else if (attempt.status === "DRAFTING" || attempt.status === "REVISING") {
    // ok
  } else {
    await prisma.storyAttempt.update({
      where: { id: attemptId },
      data: { status: "DRAFTING" },
    });
  }

  if (attempt.assignment.trackProcess) {
    await prisma.storyIntegrityEvent.create({
      data: {
        attemptId,
        kind: "AUTOSAVE",
        meta: { scope: "section", kind, wordCount },
      },
    });
  }
  return { ok: true as const, wordCount };
}

export async function recordStoryPasteEvent(
  attemptId: string,
  wordCount: number,
  blocked: boolean,
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const attempt = await assertStudentOwnsAttempt(attemptId, session.user.id);
  if (!attempt) return { error: "Not found" };
  if (!attempt.assignment.trackProcess && !attempt.assignment.restrictLargePaste) {
    return { ok: true as const };
  }
  await prisma.storyIntegrityEvent.create({
    data: {
      attemptId,
      kind: blocked ? "PASTE_BLOCKED" : "PASTE_ATTEMPT",
      meta: {
        message: `Large paste attempt: ${wordCount} words`,
        wordCount,
      },
    },
  });
  return { ok: true as const };
}

export async function runStoryRevisionPass(attemptId: string, passKind: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const attempt = await assertStudentOwnsAttempt(attemptId, session.user.id);
  if (!attempt) return { error: "Not found" };
  if (attempt.status === "SUBMITTED" || attempt.status === "REVIEWED") {
    return { error: "Submitted work is read-only." };
  }
  if (!(REVISION_PASS_KINDS as readonly string[]).includes(passKind)) {
    return { error: "Unknown revision pass." };
  }

  const cfg = gateConfig(attempt.assignment);
  const gate = canEnterStep("REVIEW", cfg, planGate(attempt.plan), attemptGate(attempt));
  if (!gate.ok) return { error: gate.reason || "Review locked" };

  const byKind = Object.fromEntries(attempt.sections.map((s) => [s.kind, s.body])) as Record<
    string,
    string
  >;
  const det = runDeterministicStoryChecks({
    sections: {
      beginning: byKind.BEGINNING || "",
      middle: byKind.MIDDLE || "",
      climax: byKind.CLIMAX || "",
      ending: byKind.ENDING || "",
    },
    wordTarget: attempt.assignment.wordTarget,
    wordMin: attempt.assignment.wordMin,
    wordMax: attempt.assignment.wordMax,
    grammarFocus: attempt.assignment.grammarFocus,
    vocabList: attempt.assignment.vocabList,
    vocabMinCount: attempt.assignment.vocabMinCount,
    vocabRequireAll: attempt.assignment.vocabRequireAll,
    plan: {
      characterName: attempt.plan?.characterName,
      goalText: attempt.plan?.goalText,
      problemText: attempt.plan?.problemText,
      climaxIdea: attempt.plan?.climaxIdea,
      resolutionText: attempt.plan?.resolutionText,
    },
  });

  let issues = issuesForRevisionPass(passKind, det);
  if (attempt.assignment.logicGrammarChecking) {
    const planSummary = [
      attempt.plan?.characterName,
      attempt.plan?.goalText,
      attempt.plan?.problemText,
      attempt.plan?.climaxIdea,
      attempt.plan?.resolutionText,
    ]
      .filter(Boolean)
      .join(" | ");
    const ai = await optionalAiStoryIssues({
      planSummary,
      draftExcerpt: [byKind.BEGINNING, byKind.MIDDLE, byKind.CLIMAX, byKind.ENDING]
        .filter(Boolean)
        .join("\n\n"),
      passKind,
    });
    issues = [...issues, ...ai];
  }

  const rev = await prisma.storyRevision.create({
    data: {
      attemptId,
      passKind,
      issues,
      completed: true,
      completedAt: new Date(),
    },
  });

  await prisma.storyAttempt.update({
    where: { id: attemptId },
    data: { status: "REVISING" },
  });

  revalidatePath(`/portal/stories/${attemptId}`);
  return { ok: true as const, revisionId: rev.id, issues };
}

export async function submitStoryAttempt(attemptId: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const attempt = await assertStudentOwnsAttempt(attemptId, session.user.id);
  if (!attempt) return { error: "Not found" };
  if (attempt.status === "SUBMITTED" || attempt.status === "REVIEWED") {
    return { error: "Already submitted." };
  }

  const cfg = gateConfig(attempt.assignment);
  const gate = canEnterStep("SUBMIT", cfg, planGate(attempt.plan), attemptGate(attempt));
  if (!gate.ok) return { error: gate.reason || "Cannot submit yet" };

  await prisma.storyAttempt.update({
    where: { id: attemptId },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      currentStep: "SUBMIT",
    },
  });

  if (attempt.assignment.homeworkId) {
    // For individual homework, mark homework submitted; for class, leave ASSIGNED
    // (class homework is shared) — only update if student-scoped.
    const hw = await prisma.homework.findUnique({
      where: { id: attempt.assignment.homeworkId },
    });
    if (hw?.studentId === session.user.id) {
      await prisma.homework.update({
        where: { id: hw.id },
        data: { status: "SUBMITTED" },
      });
    }
  }

  await prisma.storyIntegrityEvent.create({
    data: {
      attemptId,
      kind: "SUBMIT",
      meta: { at: new Date().toISOString() },
    },
  });

  revalidatePath(`/portal/stories/${attemptId}`);
  revalidatePath("/portal");
  if (attempt.assignment.classId) {
    revalidatePath(`/teacher/classes/${attempt.assignment.classId}`);
  }
  return { ok: true as const };
}

export async function askStoryGuide(attemptId: string, userMessage: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const attempt = await assertStudentOwnsAttempt(attemptId, session.user.id);
  if (!attempt) return { error: "Not found" };

  const refused = refuseGhostwritingRequest(userMessage);
  if (refused) {
    await prisma.storyIntegrityEvent.create({
      data: {
        attemptId,
        kind: "GUIDE_BLOCKED",
        meta: { reason: "ghostwriting_request" },
      },
    });
    return { ok: true as const, text: refused, blocked: true };
  }

  const planSummary = [
    attempt.plan?.characterName,
    attempt.plan?.settingPlace,
    attempt.plan?.goalText,
    attempt.plan?.problemText,
    attempt.plan?.climaxIdea,
  ]
    .filter(Boolean)
    .join(" | ");

  const reply = await optionalStoryGuideReply({
    step: attempt.currentStep,
    planSummary,
    userMessage,
  });
  if (reply.blocked) {
    await prisma.storyIntegrityEvent.create({
      data: {
        attemptId,
        kind: "GUIDE_BLOCKED",
        meta: { reason: "scrubbed_or_refused" },
      },
    });
  }
  return { ok: true as const, text: reply.text, blocked: reply.blocked };
}

export async function teacherSetPlanApproval(
  attemptId: string,
  decision: "APPROVED" | "CHANGES_REQUESTED",
  note?: string,
) {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const attempt = await assertTeacherCanReviewAttempt(
    attemptId,
    session.user.id,
    session.user.role,
  );
  if (!attempt) return { error: "Not found" };

  await prisma.storyAttempt.update({
    where: { id: attemptId },
    data: {
      planApproval: decision,
      status: decision === "APPROVED" ? "DRAFTING" : "PLANNING",
    },
  });
  if (note?.trim()) {
    await prisma.storyTeacherFeedback.upsert({
      where: { attemptId },
      create: {
        attemptId,
        body: note.trim().slice(0, 5000),
        createdById: session.user.id,
      },
      update: { body: note.trim().slice(0, 5000) },
    });
  }
  revalidatePath(`/portal/stories/${attemptId}`);
  revalidatePath(`/teacher/stories/${attemptId}`);
  return { ok: true as const };
}

export async function teacherSaveStoryFeedback(attemptId: string, body: string) {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const attempt = await assertTeacherCanReviewAttempt(
    attemptId,
    session.user.id,
    session.user.role,
  );
  if (!attempt) return { error: "Not found" };

  await prisma.storyTeacherFeedback.upsert({
    where: { attemptId },
    create: {
      attemptId,
      body: body.trim().slice(0, 8000),
      createdById: session.user.id,
    },
    update: { body: body.trim().slice(0, 8000) },
  });

  if (attempt.status === "SUBMITTED") {
    await prisma.storyAttempt.update({
      where: { id: attemptId },
      data: { status: "REVIEWED" },
    });
  }
  revalidatePath(`/teacher/stories/${attemptId}`);
  return { ok: true as const };
}

export async function getStoryAttemptForPage(attemptId: string) {
  return loadStoryAttemptBundle(attemptId);
}

export async function listEnabledStepsForAssignment(
  assignment: Parameters<typeof gateConfig>[0],
) {
  return enabledSteps(gateConfig(assignment));
}
