import { prisma } from "@/lib/db";
import { getActiveClassIdsForStudent, requireRole } from "@/lib/portal-access";
import {
  StudentFilesBrowser,
  type StudentFileItem,
  type StudentFolderItem,
} from "@/components/portal/StudentFilesBrowser";
import Link from "next/link";

export default async function ResourcesPage() {
  const session = await requireRole("STUDENT");
  const studentId = session.user.id;
  const classIds = await getActiveClassIdsForStudent(studentId);

  const [files, folders, stars] = await Promise.all([
    prisma.resource.findMany({
      where: {
        OR: [
          { studentId },
          ...(classIds.length ? [{ classId: { in: classIds } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.resourceFolder.findMany({
      where: { ownerId: studentId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.resourceStar.findMany({
      where: { studentId },
      select: { resourceId: true },
    }),
  ]);

  const starred = new Set(stars.map((s) => s.resourceId));
  const fileItems: StudentFileItem[] = files.map((f) => ({
    id: f.id,
    title: f.title,
    filename: f.filename,
    mimeType: f.mimeType,
    materialKind: f.materialKind,
    tags: f.tags || [],
    folderId: f.folderId,
    starred: starred.has(f.id),
  }));
  const folderItems: StudentFolderItem[] = folders.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
            Files
          </h1>
          <p className="mt-2 text-muted">
            Drive-style grid with folders, search, and stars. PDF thumbnails load through the
            download proxy. Open PDFs in Read / Write mode to build target vocabulary.
          </p>
        </div>
        <Link href="/portal" className="text-sm font-bold text-desk-accent hover:underline">
          ← My Desk
        </Link>
      </div>
      <div className="mt-6">
        <StudentFilesBrowser files={fileItems} folders={folderItems} />
      </div>
    </div>
  );
}