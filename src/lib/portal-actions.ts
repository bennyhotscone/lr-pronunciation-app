"use server";

import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { isValidAvatarId } from "@/lib/avatars";
import { uploadPortalFile } from "@/lib/portal-files";
import { parseMaterialKind } from "@/lib/material-kind";
import {
  assertTeacherOwnsClass,
  homeForRole,
  isAdmin,
  isStaff,
  studentCanAccessClassPost,
} from "@/lib/portal-access";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  consumePasswordResetToken,
  issuePasswordResetForEmail,
} from "@/lib/password-reset";
import { createRawResetToken, hashResetToken, isMailConfigured } from "@/lib/mail";

function randomTempPassword() {
  const n = Math.random().toString(36).slice(2, 8);
  return `Temp${n}!`;
}

/** Accept relative paths or absolute URLs; keep only same-app pathnames. */
function normalizeAppCallback(callbackUrl: string): string {
  const raw = callbackUrl.trim();
  if (!raw) return "";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    const path = `${u.pathname}${u.search}${u.hash}`;
    if (
      path.startsWith("/join") ||
      path.startsWith("/portal") ||
      path.startsWith("/teacher") ||
      path.startsWith("/english-for-mandarin-speakers")
    ) {
      return path;
    }
  } catch {
    /* ignore */
  }
  return "";
}

async function requireStaffSession() {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) {
    return null;
  }
  return session;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const callbackUrl = String(formData.get("callbackUrl") || "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.archivedAt) {
    return { error: "Invalid email or password." };
  }
  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return { error: "Invalid email or password." };
  }

  const safeCallback = normalizeAppCallback(callbackUrl);
  const defaultDest = homeForRole(user.role);
  let redirectTo = safeCallback || defaultDest;
  if (
    isStaff(user.role) &&
    redirectTo.startsWith("/portal") &&
    !redirectTo.startsWith("/portal/learn-japanese") &&
    !redirectTo.startsWith("/portal/learn-grammar")
  ) {
    redirectTo = "/teacher";
  }
  if (user.role === "STUDENT" && redirectTo.startsWith("/teacher")) redirectTo = "/portal";
  if (user.role !== "ADMIN" && redirectTo.startsWith("/english-for-mandarin-speakers/studio")) {
    redirectTo = defaultDest;
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw err;
  }
}

/** Public student self-signup — always creates STUDENT, never TEACHER/ADMIN. */
export async function signupStudentAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("fullName") || "").trim();
  const preferredName = String(formData.get("preferredName") || "").trim();
  const callbackUrl = String(formData.get("callbackUrl") || "");

  if (!email || !password || !fullName) {
    return { error: "Email, full name, and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists. Try logging in." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const display = preferredName || fullName.split(" ")[0] || fullName;

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "STUDENT",
      profile: {
        create: {
          fullName,
          preferredName: display,
          avatarId: "fox",
        },
      },
    },
  });

  const safeCallback =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "";
  const redirectTo =
    safeCallback.startsWith("/join") || safeCallback.startsWith("/portal")
      ? safeCallback
      : "/portal";

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        error: "Account created, but auto-login failed. Please log in.",
      };
    }
    throw err;
  }
}

function passwordResetResultMessage(result: {
  mailed: boolean;
  mailConfigured: boolean;
  resetUrl?: string;
}): string {
  if (result.mailed) {
    return "If an account exists for that email, a reset link was emailed. Check your inbox (and spam).";
  }
  if (result.resetUrl) {
    return result.mailConfigured
      ? "Email sending failed. Use this one-time link to set a new password (valid 1 hour)."
      : "Email is not configured on this server. Use this one-time link to set a new password (valid 1 hour).";
  }
  if (result.mailConfigured) {
    return "If an account exists for that email, a reset link was emailed. Check your inbox (and spam).";
  }
  return "No reset link to show for that email. Check the address, or ask your teacher to set a new password from your student page.";
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Enter your email address." };

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto =
      h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = `${proto}://${host}`;

    const result = await issuePasswordResetForEmail({ email, origin });

    return {
      ok: true as const,
      mailed: result.mailed,
      mailConfigured: result.mailConfigured,
      resetUrl: result.resetUrl,
      message: passwordResetResultMessage(result),
    };
  } catch (err) {
    console.error("[requestPasswordResetAction]", err);
    return {
      error:
        "Could not create a reset link right now. Please try again in a moment.",
    };
  }
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (!token) return { error: "Missing reset token." };
  if (password !== confirm) return { error: "Passwords do not match." };

  try {
    const result = await consumePasswordResetToken({
      rawToken: token,
      newPassword: password,
    });
    if ("error" in result) return { error: result.error };
    return { ok: true as const };
  } catch (err) {
    console.error("[resetPasswordAction]", err);
    return { error: "Could not update password. Please try again." };
  }
}

/** Staff: set a student's password directly (always works without email). */
export async function teacherSetStudentPassword(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const studentId = String(formData.get("studentId") || "");
  let newPassword = String(formData.get("newPassword") || "").trim();
  if (!studentId) return { error: "Student required." };
  if (!newPassword) newPassword = randomTempPassword();
  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", archivedAt: null },
  });
  if (!student) return { error: "Student not found." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: studentId },
    data: { passwordHash },
  });
  // Invalidate outstanding reset tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId: studentId, usedAt: null },
    data: { usedAt: new Date() },
  });

  revalidatePath(`/teacher/students/${studentId}`);
  return { ok: true as const, email: student.email, newPassword };
}

/** Staff: mint a copyable one-time reset link for a student. */
export async function teacherIssueStudentResetLink(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const studentId = String(formData.get("studentId") || "");
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", archivedAt: null },
  });
  if (!student) return { error: "Student not found." };

  await prisma.passwordResetToken.updateMany({
    where: { userId: studentId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const raw = createRawResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: studentId,
      tokenHash: hashResetToken(raw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const resetUrl = `${proto}://${host}/reset-password?token=${raw}`;

  return {
    ok: true as const,
    resetUrl,
    mailConfigured: isMailConfigured(),
    expiresIn: "1 hour",
  };
}

export async function teacherCreateStudent(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("fullName") || "").trim();
  const preferredName = String(formData.get("preferredName") || "").trim();
  let tempPassword = String(formData.get("tempPassword") || "").trim();
  if (!email || !fullName) {
    return { error: "Email and full name are required." };
  }
  if (!tempPassword) tempPassword = randomTempPassword();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "STUDENT",
      profile: {
        create: {
          fullName,
          preferredName: preferredName || fullName.split(" ")[0] || fullName,
          avatarId: "fox",
        },
      },
    },
  });

  revalidatePath("/teacher");
  return {
    ok: true as const,
    studentId: user.id,
    email,
    tempPassword,
  };
}

/** Admin only — creates a TEACHER account (never ADMIN). */
export async function adminCreateTeacher(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return { error: "Unauthorized" };
  }

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("fullName") || "").trim();
  const preferredName = String(formData.get("preferredName") || "").trim();
  let tempPassword = String(formData.get("tempPassword") || "").trim();
  if (!email || !fullName) {
    return { error: "Email and full name are required." };
  }
  if (!tempPassword) tempPassword = randomTempPassword();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "TEACHER",
      profile: {
        create: {
          fullName,
          preferredName: preferredName || fullName.split(" ")[0] || fullName,
          avatarId: "book",
        },
      },
    },
  });

  revalidatePath("/teacher");
  return {
    ok: true as const,
    teacherId: user.id,
    email,
    tempPassword,
  };
}

export async function teacherCreateClass(formData: FormData): Promise<void> {
  const session = await requireStaffSession();
  if (!session) throw new Error("Unauthorized");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const level = String(formData.get("level") || "").trim();
  if (!name) {
    throw new Error("Class name is required.");
  }

  // Prefer classroom-actions.teacherCreateClassroom for invite codes; keep this path working.
  const { generateInviteCode } = await import("@/lib/invite-code");
  let inviteCode = generateInviteCode(6);
  for (let i = 0; i < 12; i++) {
    const clash = await prisma.class.findUnique({ where: { inviteCode } });
    if (!clash) break;
    inviteCode = generateInviteCode(6);
  }

  const klass = await prisma.class.create({
    data: {
      name,
      description: description || null,
      level: level || null,
      teacherId: session.user.id,
      inviteCode,
    },
  });

  revalidatePath("/teacher");
  redirect(`/teacher/classes/${klass.id}`);
}

export async function enrollStudentInClass(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const classId = String(formData.get("classId") || "");
  const studentId = String(formData.get("studentId") || "");
  await assertTeacherOwnsClass(session.user.id, classId, session.user.role);

  await prisma.classMembership.upsert({
    where: { classId_studentId: { classId, studentId } },
    create: { classId, studentId, status: "ACTIVE" },
    update: { status: "ACTIVE", leftAt: null },
  });

  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/portal");
  return { ok: true as const };
}

export async function removeStudentFromClass(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const classId = String(formData.get("classId") || "");
  const studentId = String(formData.get("studentId") || "");
  await assertTeacherOwnsClass(session.user.id, classId, session.user.role);

  await prisma.classMembership.updateMany({
    where: { classId, studentId },
    data: { status: "LEFT", leftAt: new Date() },
  });

  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/portal");
  return { ok: true as const };
}

export async function teacherAddLesson(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const teacherNotes = String(formData.get("teacherNotes") || "").trim();
  const tagsRaw = String(formData.get("tags") || "").trim();
  const dateRaw = String(formData.get("date") || "");
  const classId = String(formData.get("classId") || "") || null;
  const studentId = String(formData.get("studentId") || "") || null;

  if (!title) return { error: "Title is required." };
  if (!classId && !studentId) {
    return { error: "Assign to a class or an individual student." };
  }
  if (classId) await assertTeacherOwnsClass(session.user.id, classId, session.user.role);

  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const basketRaw = String(formData.get("basketItems") || "");
  let basketItems: BasketMeta[] = [];
  if (basketRaw) {
    try {
      basketItems = JSON.parse(basketRaw) as BasketMeta[];
    } catch {
      basketItems = [];
    }
  }

  const lesson = await prisma.lesson.create({
    data: {
      title,
      summary: summary || null,
      teacherNotes: teacherNotes || null,
      tags,
      date: dateRaw ? new Date(dateRaw) : new Date(),
      classId,
      studentId,
      createdById: session.user.id,
    },
  });

  if (basketItems.length) {
    await attachBasketItemsAsResources({
      items: basketItems,
      uploadedById: session.user.id,
      classId,
      studentId,
      lessonId: lesson.id,
    });
  }

  if (classId) revalidatePath(`/teacher/classes/${classId}`);
  if (studentId) revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/portal");
  revalidatePath("/portal/lessons");
  return { ok: true as const, lessonId: lesson.id };
}

export async function teacherAddHomework(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const title = String(formData.get("title") || "").trim();
  const instructions = String(formData.get("instructions") || "").trim();
  const dueRaw = String(formData.get("dueAt") || "");
  const classId = String(formData.get("classId") || "") || null;
  const studentId = String(formData.get("studentId") || "") || null;
  const lessonId = String(formData.get("lessonId") || "") || null;

  if (!title || !instructions) {
    return { error: "Title and instructions are required." };
  }
  if (!classId && !studentId) {
    return { error: "Assign homework to a class or student." };
  }
  if (classId) await assertTeacherOwnsClass(session.user.id, classId, session.user.role);

  await prisma.homework.create({
    data: {
      title,
      instructions,
      dueAt: dueRaw ? new Date(dueRaw) : null,
      classId,
      studentId,
      lessonId,
      createdById: session.user.id,
    },
  });

  if (classId) revalidatePath(`/teacher/classes/${classId}`);
  if (studentId) revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/portal");
  return { ok: true as const };
}

export async function teacherUploadResource(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }

  const title = String(formData.get("title") || "").trim() || file.name;
  const description = String(formData.get("description") || "").trim();
  const classId = String(formData.get("classId") || "") || null;
  const studentId = String(formData.get("studentId") || "") || null;
  const lessonId = String(formData.get("lessonId") || "") || null;
  const materialKind = parseMaterialKind(formData.get("materialKind"));

  if (!classId && !studentId) {
    return { error: "Assign the file to a class or student." };
  }
  if (classId) await assertTeacherOwnsClass(session.user.id, classId, session.user.role);

  try {
    const { maybeTrimPdfUpload } = await import("@/lib/pdf-trim");
    const trimmed = await maybeTrimPdfUpload(file, formData.get("selectedPages"));
    const scope = classId || studentId!;
    const uploaded = await uploadPortalFile({ file: trimmed.file, scope });

    await prisma.resource.create({
      data: {
        title: title === file.name ? uploaded.filename : title,
        description: description || null,
        filename: uploaded.filename,
        blobPath: uploaded.blobPath,
        blobUrl: uploaded.blobUrl,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        classId,
        studentId,
        lessonId,
        uploadedById: session.user.id,
        category: studentId && !classId ? "just-for-you" : "class",
        materialKind,
      },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }

  if (classId) revalidatePath(`/teacher/classes/${classId}`);
  if (studentId) revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/portal");
  revalidatePath("/portal/resources");
  return { ok: true as const };
}

const ALLOWED_TARGET_LANGS = new Set([
  "zh-CN",
  "zh-TW",
  "ja",
  "th",
  "ko",
  "vi",
  "es",
  "fr",
  "id",
  "en",
]);

export async function updateStudentProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }

  const preferredName = String(formData.get("preferredName") || "").trim();
  const avatarId = String(formData.get("avatarId") || "fox");
  const targetLangRaw = String(formData.get("targetLang") || "zh-CN").trim();
  const targetLang = ALLOWED_TARGET_LANGS.has(targetLangRaw) ? targetLangRaw : "zh-CN";
  const deskThemeRaw = String(formData.get("deskTheme") || "slate").trim();
  const deskTheme =
    deskThemeRaw === "warm" || deskThemeRaw === "classic" ? deskThemeRaw : "slate";
  if (!preferredName) return { error: "Preferred name is required." };
  if (!isValidAvatarId(avatarId)) return { error: "Invalid avatar." };

  await prisma.studentProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      preferredName,
      avatarId,
      targetLang,
      deskTheme,
    },
    update: { preferredName, avatarId, targetLang, deskTheme },
  });

  revalidatePath("/portal");
  revalidatePath("/portal/profile");
  return { ok: true as const, preferredName, avatarId, targetLang, deskTheme };
}

export async function saveDiaryEntry(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const body = String(formData.get("body") || "").trim();
  const title = String(formData.get("title") || "").trim();
  if (!body) return { error: "Write something first." };

  await prisma.diaryEntry.create({
    data: {
      studentId: session.user.id,
      body,
      title: title || null,
      visibility: "SHARED",
    },
  });
  revalidatePath("/portal/diary");
  return { ok: true as const };
}

async function syncGoalProgressFromChecklist(goalId: string) {
  const items = await prisma.goalChecklistItem.findMany({
    where: { goalId },
    select: { done: true },
  });
  if (!items.length) return null;
  const done = items.filter((i) => i.done).length;
  const progressPct = Math.round((done / items.length) * 100);
  await prisma.goal.update({
    where: { id: goalId },
    data: { progressPct },
  });
  return progressPct;
}

/** Students may update notes only — checklist ticks are teacher-only. */
export async function upsertGoalProgress(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const goalId = String(formData.get("goalId") || "");
  const studentNotes = String(formData.get("studentNotes") || "").trim();

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, studentId: session.user.id },
    include: { checklistItems: { select: { id: true } } },
  });
  if (!goal) return { error: "Goal not found." };

  await prisma.goal.update({
    where: { id: goalId },
    data: {
      studentNotes: studentNotes || null,
    },
  });

  await prisma.learningProgress.upsert({
    where: {
      userId_kind_refId: {
        userId: session.user.id,
        kind: "goal",
        refId: goalId,
      },
    },
    create: {
      userId: session.user.id,
      kind: "goal",
      refId: goalId,
      data: { progressPct: goal.progressPct, studentNotes },
    },
    update: {
      data: { progressPct: goal.progressPct, studentNotes },
    },
  });

  revalidatePath("/portal/goals");
  revalidatePath("/portal");
  return { ok: true as const };
}

export async function teacherAddGoal(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const studentId = String(formData.get("studentId") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const tierRaw = Number.parseInt(String(formData.get("pyramidTier") || "2"), 10);
  const pyramidTier = tierRaw === 1 || tierRaw === 3 ? tierRaw : 2;
  const checklistRaw = String(formData.get("checklistItems") || "");
  const checklistTitles = checklistRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);
  if (!studentId || !title) return { error: "Student and title required." };

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT" },
    select: { id: true },
  });
  if (!student) return { error: "Student not found." };

  await prisma.goal.create({
    data: {
      studentId,
      title,
      description: description || null,
      pyramidTier,
      checklistItems: checklistTitles.length
        ? {
            create: checklistTitles.map((itemTitle, index) => ({
              title: itemTitle,
              sortOrder: index,
            })),
          }
        : undefined,
    },
  });
  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/portal/goals");
  revalidatePath("/portal");
  return { ok: true as const };
}

export async function teacherAddGoalChecklistItem(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const goalId = String(formData.get("goalId") || "");
  const title = String(formData.get("title") || "").trim();
  if (!goalId || !title) return { error: "Goal and checklist step required." };

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) return { error: "Goal not found." };

  const last = await prisma.goalChecklistItem.findFirst({
    where: { goalId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.goalChecklistItem.create({
    data: {
      goalId,
      title,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  await syncGoalProgressFromChecklist(goalId);

  revalidatePath(`/teacher/students/${goal.studentId}`);
  revalidatePath("/portal/goals");
  revalidatePath("/portal");
  return { ok: true as const };
}

/** Only teachers/admins can tick checklist items (accountability). */
export async function teacherToggleGoalChecklistItem(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const itemId = String(formData.get("itemId") || "");
  if (!itemId) return { error: "Item required." };

  const item = await prisma.goalChecklistItem.findUnique({
    where: { id: itemId },
    include: { goal: true },
  });
  if (!item) return { error: "Checklist item not found." };

  const nextDone = !item.done;
  await prisma.goalChecklistItem.update({
    where: { id: itemId },
    data: {
      done: nextDone,
      doneAt: nextDone ? new Date() : null,
    },
  });
  await syncGoalProgressFromChecklist(item.goalId);

  revalidatePath(`/teacher/students/${item.goal.studentId}`);
  revalidatePath("/portal/goals");
  revalidatePath("/portal");
  return { ok: true as const };
}

/**
 * Student self-help from “I need more help with this topic”.
 * Free: curated links elsewhere; here we only create/update a STUDENT_HELP goal + practice checklist.
 */
export async function studentAddTopicHelpGoal(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }

  const topicRaw = String(formData.get("topic") || "").trim();
  const classId = String(formData.get("classId") || "").trim() || null;
  const topic = topicRaw.toLowerCase().replace(/\s+/g, " ");
  if (!topic || topic.length > 80) return { error: "Pick a topic first." };

  if (classId) {
    const member = await prisma.classMembership.findFirst({
      where: { classId, studentId: session.user.id, status: "ACTIVE" },
      select: { id: true },
    });
    if (!member) return { error: "Not a member of that classroom." };
  }

  const { freeHelpPracticeSteps } = await import("@/lib/info-tag-links");
  const { matchTopicPack, competencyChecksFromPack } = await import(
    "@/lib/topic-suggestions"
  );
  const pack = matchTopicPack(topic);
  const steps = [
    ...freeHelpPracticeSteps(topic),
    ...competencyChecksFromPack(pack?.items || []),
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  const skillLabel = pack?.label || topic;
  const title = `Skills: ${skillLabel}`;
  const description = classId
    ? `Competency checklist for “${skillLabel}” from your classroom. Only your teacher can tick these off.`
    : `Competency checklist for “${skillLabel}”. Only your teacher can tick these off.`;

  const existing = await prisma.goal.findFirst({
    where: {
      studentId: session.user.id,
      source: "STUDENT_HELP",
      topicTag: topic,
      status: "ACTIVE",
    },
    include: { checklistItems: { select: { id: true, title: true } } },
  });

  if (existing) {
    // Refresh to competency wording when the student asks for help again.
    await prisma.goalChecklistItem.deleteMany({ where: { goalId: existing.id } });
    await prisma.goalChecklistItem.createMany({
      data: steps.map((itemTitle, index) => ({
        goalId: existing.id,
        title: itemTitle,
        sortOrder: index,
      })),
    });
    await prisma.goal.update({
      where: { id: existing.id },
      data: { description, title, progressPct: 0 },
    });
    await syncGoalProgressFromChecklist(existing.id);
    await prisma.learningProgress.upsert({
      where: {
        userId_kind_refId: {
          userId: session.user.id,
          kind: "topic-help",
          refId: topic,
        },
      },
      create: {
        userId: session.user.id,
        kind: "topic-help",
        refId: topic,
        data: { goalId: existing.id, topic, classId },
      },
      update: { data: { goalId: existing.id, topic, classId } },
    });
    revalidatePath("/portal/goals");
    revalidatePath("/portal");
    if (classId) revalidatePath(`/portal/classrooms/${classId}`);
    return { ok: true as const, goalId: existing.id, created: false as const };
  }

  const goal = await prisma.goal.create({
    data: {
      studentId: session.user.id,
      title,
      description,
      source: "STUDENT_HELP",
      topicTag: topic,
      pyramidTier: 1,
      checklistItems: {
        create: steps.map((itemTitle, index) => ({
          title: itemTitle,
          sortOrder: index,
        })),
      },
    },
  });

  await prisma.learningProgress.upsert({
    where: {
      userId_kind_refId: {
        userId: session.user.id,
        kind: "topic-help",
        refId: topic,
      },
    },
    create: {
      userId: session.user.id,
      kind: "topic-help",
      refId: topic,
      data: { goalId: goal.id, topic, classId },
    },
    update: { data: { goalId: goal.id, topic, classId } },
  });

  revalidatePath("/portal/goals");
  revalidatePath("/portal");
  if (classId) revalidatePath(`/portal/classrooms/${classId}`);
  return { ok: true as const, goalId: goal.id, created: true as const };
}

/** Students cannot tick checklist items — only teachers/admins confirm competency. */
export async function studentToggleSelfHelpChecklistItem(_formData: FormData) {
  return { error: "Only your teacher can tick skills off. You can leave notes instead." };
}

export async function teacherAddRecommendation(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const title = String(formData.get("title") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const classId = String(formData.get("classId") || "") || null;
  const studentId = String(formData.get("studentId") || "") || null;
  const approval = String(formData.get("approval") || "APPROVED");
  if (!title) return { error: "Title required." };
  if (!classId && !studentId) return { error: "Assign to class or student." };
  if (classId) await assertTeacherOwnsClass(session.user.id, classId, session.user.role);

  await prisma.recommendation.create({
    data: {
      title,
      url: url || null,
      description: description || null,
      classId,
      studentId,
      approval: approval === "DRAFT" ? "DRAFT" : "APPROVED",
      type: "LINK",
    },
  });
  if (classId) revalidatePath(`/teacher/classes/${classId}`);
  if (studentId) revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/portal");
  return { ok: true as const };
}

type BasketMeta = {
  blobPath: string;
  blobUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  materialKind?: string;
};

async function attachBasketItemsAsResources(opts: {
  items: BasketMeta[];
  uploadedById: string;
  classId: string | null;
  studentId: string | null;
  lessonId?: string | null;
}) {
  for (const item of opts.items) {
    if (!item.blobPath?.startsWith("portal-files/session-basket/")) continue;
    await prisma.resource.create({
      data: {
        title: item.filename || "Session file",
        filename: item.filename || "file",
        blobPath: item.blobPath,
        blobUrl: item.blobUrl,
        mimeType: item.mimeType || "application/octet-stream",
        sizeBytes: item.sizeBytes ?? null,
        classId: opts.classId,
        studentId: opts.studentId,
        lessonId: opts.lessonId || null,
        uploadedById: opts.uploadedById,
        category: "session-basket",
        materialKind: parseMaterialKind(item.materialKind),
      },
    });
  }
}

export async function teacherCreateClassPost(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const classId = String(formData.get("classId") || "");
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const pin = String(formData.get("pin") || "") === "1";
  if (!classId || !title || !body) {
    return { error: "Class, title, and body are required." };
  }
  await assertTeacherOwnsClass(session.user.id, classId, session.user.role);

  const basketRaw = String(formData.get("basketItems") || "");
  let basketItems: BasketMeta[] = [];
  if (basketRaw) {
    try {
      basketItems = JSON.parse(basketRaw) as BasketMeta[];
    } catch {
      basketItems = [];
    }
  }

  const post = await prisma.classPost.create({
    data: {
      classId,
      authorId: session.user.id,
      title,
      body,
      pinnedAt: pin ? new Date() : null,
      attachments: basketItems.length
        ? {
            create: basketItems
              .filter((i) => i.blobPath?.startsWith("portal-files/"))
              .map((i) => ({
                filename: i.filename || "file",
                blobPath: i.blobPath,
                blobUrl: i.blobUrl,
                mimeType: i.mimeType || "application/octet-stream",
                sizeBytes: i.sizeBytes ?? null,
                materialKind: parseMaterialKind(i.materialKind),
              })),
          }
        : undefined,
    },
  });

  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/portal");
  return { ok: true as const, postId: post.id };
}

export async function teacherTogglePinPost(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const postId = String(formData.get("postId") || "");
  const post = await prisma.classPost.findUnique({ where: { id: postId } });
  if (!post) return { error: "Post not found." };
  await assertTeacherOwnsClass(session.user.id, post.classId, session.user.role);

  await prisma.classPost.update({
    where: { id: postId },
    data: { pinnedAt: post.pinnedAt ? null : new Date() },
  });

  revalidatePath(`/teacher/classes/${post.classId}`);
  revalidatePath("/portal");
  return { ok: true as const, pinned: !post.pinnedAt };
}

export async function studentCommentOnPost(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const postId = String(formData.get("postId") || "");
  const body = String(formData.get("body") || "").trim();
  const parentId = String(formData.get("parentId") || "") || null;
  if (!postId || !body) return { error: "Comment text is required." };

  const allowed = await studentCanAccessClassPost(session.user.id, postId);
  if (!allowed) return { error: "You cannot comment on this post." };

  if (parentId) {
    const parent = await prisma.classPostComment.findFirst({
      where: { id: parentId, postId },
    });
    if (!parent) return { error: "Parent comment not found." };
  }

  await prisma.classPostComment.create({
    data: {
      postId,
      authorId: session.user.id,
      body,
      parentId,
    },
  });

  const post = await prisma.classPost.findUnique({ where: { id: postId } });
  if (post) {
    revalidatePath(`/teacher/classes/${post.classId}`);
    revalidatePath("/portal");
  }
  return { ok: true as const };
}

export async function staffCommentOnPost(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const postId = String(formData.get("postId") || "");
  const body = String(formData.get("body") || "").trim();
  const parentId = String(formData.get("parentId") || "") || null;
  if (!postId || !body) return { error: "Comment text is required." };

  const post = await prisma.classPost.findUnique({ where: { id: postId } });
  if (!post) return { error: "Post not found." };
  await assertTeacherOwnsClass(session.user.id, post.classId, session.user.role);

  if (parentId) {
    const parent = await prisma.classPostComment.findFirst({
      where: { id: parentId, postId },
    });
    if (!parent) return { error: "Parent comment not found." };
  }

  await prisma.classPostComment.create({
    data: {
      postId,
      authorId: session.user.id,
      body,
      parentId,
    },
  });

  revalidatePath(`/teacher/classes/${post.classId}`);
  revalidatePath("/portal");
  return { ok: true as const };
}
