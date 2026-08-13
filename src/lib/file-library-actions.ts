"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getActiveClassIdsForStudent } from "@/lib/portal-access";
import { revalidatePath } from "next/cache";

async function requireStudent() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") return null;
  return session;
}

async function studentCanSeeResource(studentId: string, resourceId: string) {
  const classIds = await getActiveClassIdsForStudent(studentId);
  const resource = await prisma.resource.findFirst({
    where: {
      id: resourceId,
      OR: [
        { studentId },
        ...(classIds.length ? [{ classId: { in: classIds } }] : []),
      ],
    },
    select: { id: true, folderId: true },
  });
  return resource;
}

export async function studentCreateFolder(formData: FormData) {
  const session = await requireStudent();
  if (!session) return { error: "Unauthorized" };
  const name = String(formData.get("name") || "").trim().slice(0, 80);
  const parentId = String(formData.get("parentId") || "").trim() || null;
  if (!name) return { error: "Folder name is required." };

  if (parentId) {
    const parent = await prisma.resourceFolder.findFirst({
      where: { id: parentId, ownerId: session.user.id },
    });
    if (!parent) return { error: "Parent folder not found." };
  }

  const classIds = await getActiveClassIdsForStudent(session.user.id);
  await prisma.resourceFolder.create({
    data: {
      name,
      ownerId: session.user.id,
      parentId,
      classId: classIds[0] ?? null,
    },
  });
  revalidatePath("/portal/resources");
  return { ok: true as const };
}

export async function studentRenameFolder(formData: FormData) {
  const session = await requireStudent();
  if (!session) return { error: "Unauthorized" };
  const folderId = String(formData.get("folderId") || "").trim();
  const name = String(formData.get("name") || "").trim().slice(0, 80);
  if (!folderId || !name) return { error: "Missing folder name." };

  const folder = await prisma.resourceFolder.findFirst({
    where: { id: folderId, ownerId: session.user.id },
  });
  if (!folder) return { error: "Folder not found." };

  await prisma.resourceFolder.update({ where: { id: folderId }, data: { name } });
  revalidatePath("/portal/resources");
  return { ok: true as const };
}

export async function studentDeleteFolder(formData: FormData) {
  const session = await requireStudent();
  if (!session) return { error: "Unauthorized" };
  const folderId = String(formData.get("folderId") || "").trim();
  if (!folderId) return { error: "Missing folder." };

  const folder = await prisma.resourceFolder.findFirst({
    where: { id: folderId, ownerId: session.user.id },
  });
  if (!folder) return { error: "Folder not found." };

  await prisma.resource.updateMany({
    where: { folderId },
    data: { folderId: null },
  });
  await prisma.resourceFolder.delete({ where: { id: folderId } });
  revalidatePath("/portal/resources");
  return { ok: true as const };
}

export async function studentMoveResource(formData: FormData) {
  const session = await requireStudent();
  if (!session) return { error: "Unauthorized" };
  const resourceId = String(formData.get("resourceId") || "").trim();
  const folderIdRaw = String(formData.get("folderId") || "").trim();
  const folderId = folderIdRaw === "" || folderIdRaw === "root" ? null : folderIdRaw;
  if (!resourceId) return { error: "Missing file." };

  const resource = await studentCanSeeResource(session.user.id, resourceId);
  if (!resource) return { error: "File not found." };

  if (folderId) {
    const folder = await prisma.resourceFolder.findFirst({
      where: { id: folderId, ownerId: session.user.id },
    });
    if (!folder) return { error: "Folder not found." };
  }

  await prisma.resource.update({
    where: { id: resourceId },
    data: { folderId },
  });
  revalidatePath("/portal/resources");
  return { ok: true as const };
}

export async function studentToggleStar(formData: FormData) {
  const session = await requireStudent();
  if (!session) return { error: "Unauthorized" };
  const resourceId = String(formData.get("resourceId") || "").trim();
  if (!resourceId) return { error: "Missing file." };

  const resource = await studentCanSeeResource(session.user.id, resourceId);
  if (!resource) return { error: "File not found." };

  const existing = await prisma.resourceStar.findUnique({
    where: {
      studentId_resourceId: { studentId: session.user.id, resourceId },
    },
  });
  if (existing) {
    await prisma.resourceStar.delete({ where: { id: existing.id } });
  } else {
    await prisma.resourceStar.create({
      data: { studentId: session.user.id, resourceId },
    });
  }
  revalidatePath("/portal/resources");
  revalidatePath("/portal");
  return { ok: true as const, starred: !existing };
}
