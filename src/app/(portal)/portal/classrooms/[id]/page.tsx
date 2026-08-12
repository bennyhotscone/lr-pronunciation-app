import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, studentCanAccessClass } from "@/lib/portal-access";
import type { StreamLesson, StreamPost } from "@/components/classroom/ClassroomStream";
import {
  ClassroomOrganiser,
  type OrganiserTab,
} from "@/components/classroom/ClassroomOrganiser";
import { TagExplorePanel } from "@/components/classroom/TagExplorePanel";
import { buildFreeLessonSummary } from "@/lib/lesson-summary";
import { normalizeTag } from "@/lib/info-tag-links";

function authorLabel(user: {
  email: string;
  profile: { preferredName: string | null; fullName: string | null } | null;
}) {
  return user.profile?.preferredName || user.profile?.fullName || user.email;
}

export default async function StudentClassroomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tag?: string; tab?: string; day?: string }>;
}) {
  const session = await requireRole("STUDENT");
  const { id } = await params;
  const sp = await searchParams;
  const activeTag = sp.tag ? normalizeTag(sp.tag) : null;
  const initialTab = (
    ["stream", "timeline", "lessons", "calendar", "files", "tests"] as const
  ).includes(sp.tab as OrganiserTab)
    ? (sp.tab as OrganiserTab)
    : "stream";

  const allowed = await studentCanAccessClass(session.user.id, id);
  if (!allowed) notFound();

  const klass = await prisma.class.findFirst({
    where: { id, archivedAt: null },
  });
  if (!klass) notFound();

  const [postsRaw, lessons, files, classTags] = await Promise.all([
    prisma.classPost.findMany({
      where: { classId: id },
      include: {
        author: { include: { profile: true } },
        comments: {
          include: { author: { include: { profile: true } } },
          orderBy: { createdAt: "asc" },
        },
        attachments: true,
      },
      orderBy: [
        { pinnedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
    }),
    prisma.classLesson.findMany({
      where: { classId: id },
      include: { subEntries: { orderBy: { sortOrder: "asc" } }, attachments: true },
      orderBy: { day: "desc" },
      take: 80,
    }),
    prisma.resource.findMany({
      where: { classId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.classTag.findMany({
      where: { classId: id },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const knownTags = classTags.map((t) => t.name);

  const posts: StreamPost[] = postsRaw.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    tags: p.tags || [],
    pinnedAt: p.pinnedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    authorLabel: authorLabel(p.author),
    comments: p.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      authorLabel: authorLabel(c.author),
    })),
    attachments: p.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      blobUrl: a.blobUrl,
    })),
  }));

  const streamLessons: StreamLesson[] = lessons.map((d) => ({
    id: d.id,
    day: d.day.toISOString(),
    title: d.title,
    summary: buildFreeLessonSummary({
      title: d.title,
      summary: d.summary,
      subEntries: d.subEntries,
      tags: d.tags || [],
    }),
    tags: d.tags || [],
    createdAt: d.createdAt.toISOString(),
    subEntries: d.subEntries.map((s) => ({
      id: s.id,
      kind: s.kind,
      title: s.title,
      body: s.body,
    })),
    attachments: d.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      resourceId: a.resourceId,
    })),
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/portal" className="text-sm font-semibold text-desk-accent hover:underline">
          ← My Desk
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {klass.name}
        </h1>
        <p className="mt-1 text-base text-muted">
          Organiser: stream, timeline, lessons, calendar, files, and tests
        </p>
      </div>

      {activeTag ? (
        <TagExplorePanel
          classId={id}
          tag={activeTag}
          posts={postsRaw.map((p) => ({ id: p.id, title: p.title, tags: p.tags || [] }))}
          lessons={lessons.map((l) => ({
            id: l.id,
            title: l.title,
            day: l.day,
            tags: l.tags || [],
          }))}
          files={files.map((f) => ({ id: f.id, title: f.title, tags: f.tags || [] }))}
        />
      ) : null}

      <ClassroomOrganiser
        classId={id}
        posts={
          activeTag
            ? posts.filter((p) => (p.tags || []).map(normalizeTag).includes(activeTag))
            : posts
        }
        lessons={
          activeTag
            ? streamLessons.filter((l) =>
                (l.tags || []).map(normalizeTag).includes(activeTag),
              )
            : streamLessons
        }
        files={(activeTag
          ? files.filter((f) => (f.tags || []).map(normalizeTag).includes(activeTag))
          : files
        ).map((f) => ({
          id: f.id,
          title: f.title,
          filename: f.filename,
          tags: f.tags || [],
          mimeType: f.mimeType,
        }))}
        knownTags={knownTags}
        initialTab={initialTab}
      />
    </div>
  );
}
