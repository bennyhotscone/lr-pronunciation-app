"use server";

import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { isValidAvatarId } from "@/lib/avatars";
import { uploadPortalFile } from "@/lib/portal-files";
import { assertTeacherOwnsClass } from "@/lib/portal-access";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function randomTempPassword() {
  const n = Math.random().toString(36).slice(2, 8);
  return `Temp${n}!`;
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

  const safeCallback =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "";
  const defaultDest = user.role === "TEACHER" ? "/teacher" : "/portal";
  // Avoid sending teachers to /portal (or students to /teacher) via stale callback.
  let redirectTo = safeCallback || defaultDest;
  if (user.role === "TEACHER" && redirectTo.startsWith("/portal")) redirectTo = "/teacher";
  if (user.role === "STUDENT" && redirectTo.startsWith("/teacher")) redirectTo = "/portal";

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

export async function teacherCreateStudent(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
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

export async function teacherCreateClass(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return { error: "Unauthorized" };
  }
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const level = String(formData.get("level") || "").trim();
  if (!name) return { error: "Class name is required." };

  const klass = await prisma.class.create({
    data: {
      name,
      description: description || null,
      level: level || null,
      teacherId: session.user.id,
    },
  });

  revalidatePath("/teacher");
  redirect(`/teacher/classes/${klass.id}`);
}

export async function enrollStudentInClass(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return { error: "Unauthorized" };
  }
  const classId = String(formData.get("classId") || "");
  const studentId = String(formData.get("studentId") || "");
  await assertTeacherOwnsClass(session.user.id, classId);

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
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return { error: "Unauthorized" };
  }
  const classId = String(formData.get("classId") || "");
  const studentId = String(formData.get("studentId") || "");
  await assertTeacherOwnsClass(session.user.id, classId);

  await prisma.classMembership.updateMany({
    where: { classId, studentId },
    data: { status: "LEFT", leftAt: new Date() },
  });

  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/portal");
  return { ok: true as const };
}

export async function teacherAddLesson(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return { error: "Unauthorized" };
  }

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
  if (classId) await assertTeacherOwnsClass(session.user.id, classId);

  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

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

  if (classId) revalidatePath(`/teacher/classes/${classId}`);
  if (studentId) revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/portal");
  revalidatePath("/portal/lessons");
  return { ok: true as const, lessonId: lesson.id };
}

export async function teacherAddHomework(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return { error: "Unauthorized" };
  }

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
  if (classId) await assertTeacherOwnsClass(session.user.id, classId);

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
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return { error: "Unauthorized" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }

  const title = String(formData.get("title") || "").trim() || file.name;
  const description = String(formData.get("description") || "").trim();
  const classId = String(formData.get("classId") || "") || null;
  const studentId = String(formData.get("studentId") || "") || null;
  const lessonId = String(formData.get("lessonId") || "") || null;

  if (!classId && !studentId) {
    return { error: "Assign the file to a class or student." };
  }
  if (classId) await assertTeacherOwnsClass(session.user.id, classId);

  const scope = classId || studentId!;
  const uploaded = await uploadPortalFile({ file, scope });

  await prisma.resource.create({
    data: {
      title,
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
    },
  });

  if (classId) revalidatePath(`/teacher/classes/${classId}`);
  if (studentId) revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/portal");
  revalidatePath("/portal/resources");
  return { ok: true as const };
}

export async function updateStudentProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }

  const preferredName = String(formData.get("preferredName") || "").trim();
  const avatarId = String(formData.get("avatarId") || "fox");
  if (!preferredName) return { error: "Preferred name is required." };
  if (!isValidAvatarId(avatarId)) return { error: "Invalid avatar." };

  await prisma.studentProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      preferredName,
      avatarId,
    },
    update: { preferredName, avatarId },
  });

  revalidatePath("/portal");
  revalidatePath("/portal/profile");
  return { ok: true as const, preferredName, avatarId };
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

export async function upsertGoalProgress(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return { error: "Unauthorized" };
  }
  const goalId = String(formData.get("goalId") || "");
  const progressPct = Number(formData.get("progressPct") || 0);
  const studentNotes = String(formData.get("studentNotes") || "").trim();

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, studentId: session.user.id },
  });
  if (!goal) return { error: "Goal not found." };

  await prisma.goal.update({
    where: { id: goalId },
    data: {
      progressPct: Math.max(0, Math.min(100, progressPct)),
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
      data: { progressPct, studentNotes },
    },
    update: {
      data: { progressPct, studentNotes },
    },
  });

  revalidatePath("/portal/goals");
  revalidatePath("/portal");
  return { ok: true as const };
}

export async function teacherAddGoal(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return { error: "Unauthorized" };
  }
  const studentId = String(formData.get("studentId") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!studentId || !title) return { error: "Student and title required." };

  await prisma.goal.create({
    data: {
      studentId,
      title,
      description: description || null,
    },
  });
  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/portal/goals");
  return { ok: true as const };
}

export async function teacherAddRecommendation(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return { error: "Unauthorized" };
  }
  const title = String(formData.get("title") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const classId = String(formData.get("classId") || "") || null;
  const studentId = String(formData.get("studentId") || "") || null;
  const approval = String(formData.get("approval") || "APPROVED");
  if (!title) return { error: "Title required." };
  if (!classId && !studentId) return { error: "Assign to class or student." };
  if (classId) await assertTeacherOwnsClass(session.user.id, classId);

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
