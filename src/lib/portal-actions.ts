"use server";

import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { isValidAvatarId } from "@/lib/avatars";
import { uploadPortalFile } from "@/lib/portal-files";
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
import { redirect } from "next/navigation";

function randomTempPassword() {
  const n = Math.random().toString(36).slice(2, 8);
  return `Temp${n}!`;
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

  const safeCallback =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "";
  const defaultDest = homeForRole(user.role);
  let redirectTo = safeCallback || defaultDest;
  if (isStaff(user.role) && redirectTo.startsWith("/portal")) redirectTo = "/teacher";
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

  if (!classId && !studentId) {
    return { error: "Assign the file to a class or student." };
  }
  if (classId) await assertTeacherOwnsClass(session.user.id, classId, session.user.role);

  try {
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
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
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
