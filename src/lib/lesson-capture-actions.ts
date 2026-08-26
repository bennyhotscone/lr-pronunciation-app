"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  deleteAllSessionFrameBlobs,
  processLessonCaptureSession,
} from "@/lib/lesson-capture-process";
import { isAdmin, isStaff } from "@/lib/portal-access";
import type { Role } from "@prisma/client";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type BasketMeta = {
  filename: string;
  blobPath: string;
  blobUrl: string;
  mimeType: string;
  sizeBytes?: number;
};

async function requireStaffSession() {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) return null;
  return session;
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

function parseBasketItems(raw: unknown): BasketMeta[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as BasketMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function assertTeacherOwnsStudent(
  teacherId: string,
  studentId: string,
  role?: Role,
) {
  const sessionRole = role ?? (await auth())?.user?.role;
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT" },
    include: { profile: true },
  });
  if (!student) throw new Error("Student not found");

  if (sessionRole === "ADMIN") return student;

  const membership = await prisma.classMembership.findFirst({
    where: {
      studentId,
      status: "ACTIVE",
      class: { teacherId, archivedAt: null },
    },
  });
  if (!membership) throw new Error("Student not found or access denied");
  return student;
}

async function assertTeacherOwnsSession(
  teacherId: string,
  sessionId: string,
  role?: Role,
) {
  const sessionRole = role ?? (await auth())?.user?.role;
  const capture = await prisma.lessonCaptureSession.findUnique({
    where: { id: sessionId },
  });
  if (!capture) throw new Error("Session not found");
  if (sessionRole !== "ADMIN" && capture.teacherId !== teacherId) {
    throw new Error("Session not found or access denied");
  }
  return capture;
}

export async function getTeacherStudentsForCapture(teacherId: string, role: Role) {
  const memberships = await prisma.classMembership.findMany({
    where: {
      status: "ACTIVE",
      class: isAdmin(role)
        ? { archivedAt: null }
        : { teacherId, archivedAt: null },
    },
    include: {
      student: { include: { profile: true } },
    },
    orderBy: { student: { email: "asc" } },
  });

  const seen = new Set<string>();
  const students: {
    id: string;
    label: string;
    email: string;
  }[] = [];

  for (const m of memberships) {
    if (seen.has(m.studentId)) continue;
    seen.add(m.studentId);
    const s = m.student;
    students.push({
      id: s.id,
      email: s.email,
      label: s.profile?.preferredName || s.profile?.fullName || s.email,
    });
  }

  return students.sort((a, b) => a.label.localeCompare(b.label));
}

export async function teacherStartLessonCapture(formData: FormData): Promise<void> {
  const session = await requireStaffSession();
  if (!session) throw new Error("Unauthorized");

  const studentId = String(formData.get("studentId") || "").trim();
  if (!studentId) throw new Error("Choose a student.");

  await assertTeacherOwnsStudent(session.user.id, studentId, session.user.role);

  const existing = await prisma.lessonCaptureSession.findFirst({
    where: { teacherId: session.user.id, status: "ACTIVE" },
  });
  if (existing) {
    redirect(`/teacher/lesson-capture/${existing.id}`);
  }

  const created = await prisma.lessonCaptureSession.create({
    data: {
      studentId,
      teacherId: session.user.id,
    },
  });

  revalidatePath("/teacher/lesson-capture");
  redirect(`/teacher/lesson-capture/${created.id}`);
}

export async function teacherAddLessonCaptureNote(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const sessionId = String(formData.get("sessionId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Note cannot be empty." };

  const capture = await assertTeacherOwnsSession(
    session.user.id,
    sessionId,
    session.user.role,
  );
  if (capture.status !== "ACTIVE") {
    return { error: "Session has ended." };
  }

  const note = await prisma.lessonCaptureNote.create({
    data: { sessionId, body },
  });

  revalidatePath(`/teacher/lesson-capture/${sessionId}`);
  return { ok: true as const, note };
}

export async function teacherEndLessonCapture(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const sessionId = String(formData.get("sessionId") || "");
  const extraNotes = String(formData.get("notes") || "").trim();
  const topicsCovered = parseTags(formData.get("topicsCovered"));
  const basketItems = parseBasketItems(formData.get("basketItems"));

  const capture = await assertTeacherOwnsSession(
    session.user.id,
    sessionId,
    session.user.role,
  );
  if (capture.status !== "ACTIVE") {
    return { error: "Session already ended." };
  }

  const liveNotes = await prisma.lessonCaptureNote.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  const liveBlock = liveNotes
    .map((n) => {
      const t = n.createdAt.toISOString().slice(11, 16);
      return `[${t}] ${n.body}`;
    })
    .join("\n");

  const parts = [liveBlock, extraNotes].filter(Boolean);
  const notes = parts.length ? parts.join("\n\n") : null;

  const endedAt = new Date();
  const durationMs = endedAt.getTime() - capture.startedAt.getTime();

  const frameCount = await prisma.lessonCaptureFrame.count({ where: { sessionId } });
  const processing = frameCount > 0 || Boolean(notes);

  await prisma.$transaction(async (tx) => {
    await tx.lessonCaptureSession.update({
      where: { id: sessionId },
      data: {
        status: processing ? "PROCESSING" : "ENDED",
        endedAt,
        notes,
        topicsCovered,
      },
    });

    for (const item of basketItems) {
      if (!item.blobPath?.startsWith("portal-files/")) continue;
      await tx.lessonCaptureAttachment.create({
        data: {
          sessionId,
          filename: item.filename,
          blobPath: item.blobPath,
          blobUrl: item.blobUrl,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes ?? null,
        },
      });
    }
  });

  if (processing) {
    after(async () => {
      await processLessonCaptureSession(sessionId);
    });
  }

  revalidatePath("/teacher/lesson-capture");
  revalidatePath(`/teacher/lesson-capture/${sessionId}`);
  return {
    ok: true as const,
    processing,
    durationMinutes: Math.max(1, Math.round(durationMs / 60_000)),
  };
}

export async function teacherUpdateLessonCaptureSession(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const sessionId = String(formData.get("sessionId") || "");
  const summary = String(formData.get("summary") || "").trim();
  const autoNotes = String(formData.get("autoNotes") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const topicsCovered = parseTags(formData.get("topicsCovered"));

  const capture = await assertTeacherOwnsSession(
    session.user.id,
    sessionId,
    session.user.role,
  );
  if (capture.status === "ACTIVE" || capture.status === "PROCESSING") {
    return { error: "Session is still in progress." };
  }

  await prisma.lessonCaptureSession.update({
    where: { id: sessionId },
    data: {
      summary: summary || null,
      autoNotes: autoNotes || null,
      notes: notes || null,
      topicsCovered,
    },
  });

  revalidatePath(`/teacher/lesson-capture/${sessionId}`);
  return { ok: true as const };
}

export async function teacherCancelLessonCapture(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const sessionId = String(formData.get("sessionId") || "");
  const capture = await assertTeacherOwnsSession(
    session.user.id,
    sessionId,
    session.user.role,
  );
  if (capture.status !== "ACTIVE") {
    return { error: "Session already ended." };
  }

  await deleteAllSessionFrameBlobs(sessionId);
  await prisma.lessonCaptureSession.delete({ where: { id: sessionId } });

  revalidatePath("/teacher/lesson-capture");
  redirect("/teacher/lesson-capture");
}

/** Re-run AI when frames were kept (e.g. missing GROQ/OpenAI key earlier). */
export async function teacherRerunLessonCaptureAi(formData: FormData) {
  const session = await requireStaffSession();
  if (!session) return { error: "Unauthorized" };

  const sessionId = String(formData.get("sessionId") || "");
  const capture = await assertTeacherOwnsSession(
    session.user.id,
    sessionId,
    session.user.role,
  );
  if (capture.status === "ACTIVE" || capture.status === "PROCESSING") {
    return { error: "Session is still in progress." };
  }

  const frameCount = await prisma.lessonCaptureFrame.count({ where: { sessionId } });
  if (frameCount === 0) {
    return {
      error:
        "No screenshots left to analyze (frames are deleted after a successful OCR + AI run). Start a new session and use Start screen capture so OCR has frames to read.",
    };
  }

  await prisma.lessonCaptureSession.update({
    where: { id: sessionId },
    data: { status: "PROCESSING", processingError: null },
  });

  after(async () => {
    await processLessonCaptureSession(sessionId);
  });

  revalidatePath("/teacher/lesson-capture");
  revalidatePath(`/teacher/lesson-capture/${sessionId}`);
  return { ok: true as const, processing: true };
}