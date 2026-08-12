"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  assertTeacherOwnsClass,
  isStaff,
  studentCanAccessClass,
} from "@/lib/portal-access";
import { generateInviteCode } from "@/lib/invite-code";
import { enrollStudentWithInviteCode } from "@/lib/enroll-student";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

async function requireStaffSession() {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) return null;
  return session;
}

async function uniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = generateInviteCode(6);
    const exists = await prisma.class.findUnique({ where: { inviteCode: code } });
    if (!exists) return code;
  }
  return generateInviteCode(8);
}

function dayStart(dateRaw?: string): Date {
  if (dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    return new Date(`${dateRaw}T00:00:00.000Z`);
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function parseTags(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return [
        ...new Set(
          parsed
            .map((t) => String(t).trim().toLowerCase())
            .filter((t) => t.length > 0 && t.length <= 40),
        ),
      ].slice(0, 20);
    }
  } catch {
    /* comma-separated fallback */
  }
  return [
    ...new Set(
      raw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 40),
    ),
  ].slice(0, 20);
}

async function syncClassTags(classId: string, tags: string[]) {
  for (const name of tags) {
    await prisma.classTag.upsert({
      where: { classId_name: { classId, name } },
      create: { classId, name },
      update: {},
    });
  }
}

export async function teacherCreateClassroom(formData: FormData): Promise<void> {
  const session = await requireStaffSession();
  if (!session) throw new Error("Unauthorized");
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Classroom name is required.");

  const inviteCode = await uniqueInviteCode();
  const klass = await prisma.class.create({
    data: {
      name,
      inviteCode,
      teacherId: session.user.id,
    },
  });

  revalidatePath("/teacher");
  redirect(`/teacher/classes/${klass.id}`);
}

export async function teacherRegenerateInviteCode(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const classId = String(formData.get("classId") || "");
  await assertTeacherOwnsClass(session.user.id, classId, session.user.role);
  const inviteCode = await uniqueInviteCode();
  await prisma.class.update({ where: { id: classId }, data: { inviteCode } });
  revalidatePath(`/teacher/classes/${classId}`);
  return { ok: true as const, inviteCode };
}

export async function studentJoinClassroomByCode(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") {
    return {
      error: "Sign in as a student to join a classroom.",
      needAuth: true as const,
    };
  }
  return enrollStudentWithInviteCode(
    session.user.id,
    String(formData.get("code") || ""),
    { revalidate: true },
  );
}

type BasketMeta = {
  filename: string;
  blobPath: string;
  blobUrl: string;
  mimeType: string;
  sizeBytes?: number;
};

function parseBasketItems(raw: unknown): BasketMeta[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as BasketMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function teacherCreateClassPost(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const classId = String(formData.get("classId") || "");
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const pin = String(formData.get("pin") || "") === "1";
  const tags = parseTags(formData.get("tags"));
  if (!classId || !title || !body) {
    return { error: "Title and message are required." };
  }
  await assertTeacherOwnsClass(session.user.id, classId, session.user.role);
  await syncClassTags(classId, tags);

  const basketItems = parseBasketItems(formData.get("basketItems")).filter((i) =>
    i.blobPath?.startsWith("portal-files/"),
  );

  await prisma.classPost.create({
    data: {
      classId,
      authorId: session.user.id,
      title,
      body,
      tags,
      pinnedAt: pin ? new Date() : null,
      attachments: basketItems.length
        ? {
            create: basketItems.map((i) => ({
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
  revalidatePath(`/portal/classrooms/${classId}`);
  revalidatePath("/portal");
  return { ok: true as const };
}

export async function teacherUpdateClassPost(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const postId = String(formData.get("postId") || "");
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const tags = parseTags(formData.get("tags"));
  if (!postId || !title || !body) {
    return { error: "Title and message are required." };
  }

  const post = await prisma.classPost.findUnique({ where: { id: postId } });
  if (!post) return { error: "Post not found." };
  await assertTeacherOwnsClass(session.user.id, post.classId, session.user.role);
  await syncClassTags(post.classId, tags);

  const basketItems = parseBasketItems(formData.get("basketItems")).filter((i) =>
    i.blobPath?.startsWith("portal-files/"),
  );

  await prisma.classPost.update({
    where: { id: postId },
    data: { title, body, tags },
  });

  for (const item of basketItems) {
    await prisma.classPostAttachment.create({
      data: {
        postId,
        filename: item.filename || "file",
        blobPath: item.blobPath,
        blobUrl: item.blobUrl,
        mimeType: item.mimeType || "application/octet-stream",
        sizeBytes: item.sizeBytes ?? null,
      },
    });
  }

  revalidatePath(`/teacher/classes/${post.classId}`);
  revalidatePath(`/portal/classrooms/${post.classId}`);
  revalidatePath("/portal");
  return { ok: true as const };
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
  revalidatePath(`/portal/classrooms/${post.classId}`);
  return { ok: true as const };
}

export async function commentOnClassPost(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const postId = String(formData.get("postId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!postId || !body) return { error: "Comment required." };

  const post = await prisma.classPost.findUnique({ where: { id: postId } });
  if (!post) return { error: "Post not found." };

  if (session.user.role === "STUDENT") {
    const ok = await studentCanAccessClass(session.user.id, post.classId);
    if (!ok) return { error: "You are not in this classroom." };
  } else if (isStaff(session.user.role)) {
    await assertTeacherOwnsClass(session.user.id, post.classId, session.user.role);
  } else {
    return { error: "Unauthorized" };
  }

  await prisma.classPostComment.create({
    data: { postId, authorId: session.user.id, body },
  });
  revalidatePath(`/teacher/classes/${post.classId}`);
  revalidatePath(`/portal/classrooms/${post.classId}`);
  revalidatePath("/portal");
  return { ok: true as const };
}

/** Save a classroom Lesson (one session writeup) with optional sub-entries + basket files. */
export async function teacherSaveClassLesson(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const classId = String(formData.get("classId") || "");
  const dateRaw = String(formData.get("date") || "");
  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const tags = parseTags(formData.get("tags"));
  const subRaw = String(formData.get("subEntries") || "");
  if (!classId) return { error: "Classroom required." };
  await assertTeacherOwnsClass(session.user.id, classId, session.user.role);
  await syncClassTags(classId, tags);

  const day = dayStart(dateRaw);

  type Sub = { kind?: string; title: string; body?: string; tags?: string[] };
  let subs: Sub[] = [];
  if (subRaw) {
    try {
      subs = JSON.parse(subRaw) as Sub[];
    } catch {
      subs = [];
    }
  }

  const basketRaw = String(formData.get("basketItems") || "");
  type BasketMeta = {
    filename: string;
    blobPath: string;
    blobUrl: string;
    mimeType: string;
    sizeBytes?: number;
  };
  let basketItems: BasketMeta[] = [];
  if (basketRaw) {
    try {
      basketItems = JSON.parse(basketRaw) as BasketMeta[];
    } catch {
      basketItems = [];
    }
  }

  const lesson = await prisma.classLesson.upsert({
    where: { classId_day: { classId, day } },
    create: {
      classId,
      day,
      title: title || null,
      summary: summary || null,
      tags,
      createdById: session.user.id,
    },
    update: {
      title: title || null,
      summary: summary || null,
      tags,
    },
  });

  await prisma.classLessonSubEntry.deleteMany({ where: { lessonId: lesson.id } });
  if (subs.length) {
    await prisma.classLessonSubEntry.createMany({
      data: subs
        .filter((s) => s.title?.trim())
        .map((s, i) => ({
          lessonId: lesson.id,
          kind: s.kind || "NOTE",
          title: s.title.trim(),
          body: s.body?.trim() || null,
          tags: Array.isArray(s.tags)
            ? s.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10)
            : [],
          sortOrder: i,
        })),
    });
  }

  for (const item of basketItems) {
    if (!item.blobPath?.startsWith("portal-files/")) continue;
    const resource = await prisma.resource.create({
      data: {
        title: item.filename || "Class file",
        filename: item.filename || "file",
        blobPath: item.blobPath,
        blobUrl: item.blobUrl,
        mimeType: item.mimeType || "application/octet-stream",
        sizeBytes: item.sizeBytes ?? null,
        classId,
        tags,
        uploadedById: session.user.id,
        category: "class-lesson",
      },
    });
    await prisma.classLessonAttachment.create({
      data: {
        lessonId: lesson.id,
        filename: item.filename || "file",
        blobPath: item.blobPath,
        blobUrl: item.blobUrl,
        mimeType: item.mimeType || "application/octet-stream",
        sizeBytes: item.sizeBytes ?? null,
        resourceId: resource.id,
      },
    });
  }

  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath(`/portal/classrooms/${classId}`);
  revalidatePath("/portal");
  revalidatePath("/portal/resources");
  return { ok: true as const, lessonId: lesson.id };
}

export async function teacherRemoveStudentFromClass(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const classId = String(formData.get("classId") || "");
  const studentId = String(formData.get("studentId") || "");
  if (!classId || !studentId) return { error: "Class and student required." };
  await assertTeacherOwnsClass(session.user.id, classId, session.user.role);

  await prisma.classMembership.updateMany({
    where: { classId, studentId },
    data: { status: "LEFT", leftAt: new Date() },
  });

  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath(`/portal/classrooms/${classId}`);
  revalidatePath("/portal");
  revalidatePath(`/teacher/students/${studentId}`);
  return { ok: true as const };
}

export async function teacherUploadClassFile(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };
  const classId = String(formData.get("classId") || "");
  const file = formData.get("file");
  const tags = parseTags(formData.get("tags"));
  if (!classId) return { error: "Classroom required." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  await assertTeacherOwnsClass(session.user.id, classId, session.user.role);
  await syncClassTags(classId, tags);

  const { uploadPortalFile } = await import("@/lib/portal-files");
  try {
    const uploaded = await uploadPortalFile({ file, scope: classId });
    const title = String(formData.get("title") || "").trim() || uploaded.filename;
    await prisma.resource.create({
      data: {
        title,
        filename: uploaded.filename,
        blobPath: uploaded.blobPath,
        blobUrl: uploaded.blobUrl,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        classId,
        tags,
        uploadedById: session.user.id,
        category: "class",
      },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }
  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath(`/portal/classrooms/${classId}`);
  revalidatePath("/portal/resources");
  return { ok: true as const };
}

export async function getInviteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
