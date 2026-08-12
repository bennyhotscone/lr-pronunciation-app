import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertTeacherOwnsClass, requireStaff } from "@/lib/portal-access";
import { ClassroomInvitePanel } from "@/components/classroom/ClassroomInvitePanel";
import {
  ClassroomOrganiser,
  type OrganiserTab,
} from "@/components/classroom/ClassroomOrganiser";
import { ClassroomStream } from "@/components/classroom/ClassroomStream";
import { ClassLessonEditor } from "@/components/classroom/ClassLessonEditor";
import { ClassFileUpload } from "@/components/classroom/ClassFileUpload";
import { RemoveStudentButton } from "@/components/classroom/RemoveStudentButton";
import { SessionBasketProvider } from "@/components/portal/SessionBasket";
import { classroomJoinPath } from "@/lib/invite-code";
import { getInviteOrigin } from "@/lib/classroom-actions";
import { generateInviteCode } from "@/lib/invite-code";
import { buildFreeLessonSummary } from "@/lib/lesson-summary";
import type { StreamLesson, StreamPost } from "@/components/classroom/ClassroomStream";

function authorLabel(user: {
  email: string;
  profile: { preferredName: string | null; fullName: string | null } | null;
}) {
  return user.profile?.preferredName || user.profile?.fullName || user.email;
}

export default async function TeacherClassroomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const initialTab = (
    ["stream", "timeline", "lessons", "calendar", "files", "tests"] as const
  ).includes(sp.tab as OrganiserTab)
    ? (sp.tab as OrganiserTab)
    : "stream";

  let klass;
  try {
    klass = await assertTeacherOwnsClass(session.user.id, id, session.user.role);
  } catch {
    notFound();
  }

  if (klass.inviteCode.length > 10) {
    let code = generateInviteCode(6);
    for (let i = 0; i < 8; i++) {
      const clash = await prisma.class.findUnique({ where: { inviteCode: code } });
      if (!clash) break;
      code = generateInviteCode(6);
    }
    klass = await prisma.class.update({
      where: { id },
      data: { inviteCode: code },
    });
  }

  const origin = await getInviteOrigin();
  const joinUrl = `${origin}${classroomJoinPath(klass.inviteCode)}`;

  const [memberships, postsRaw, lessons, files, classTags, otherClasses] = await Promise.all([
    prisma.classMembership.findMany({
      where: { classId: id, status: "ACTIVE" },
      include: { student: { include: { profile: true } } },
      orderBy: { joinedAt: "asc" },
    }),
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
      take: 80,
    }),
    prisma.classTag.findMany({
      where: { classId: id },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    prisma.class.findMany({
      where: {
        archivedAt: null,
        ...(session.user.role === "ADMIN" ? {} : { teacherId: session.user.id }),
        NOT: { id },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 12,
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

  const fileItems = files.map((f) => ({
    id: f.id,
    title: f.title,
    filename: f.filename,
    tags: f.tags || [],
    mimeType: f.mimeType,
  }));

  return (
    <SessionBasketProvider userId={session.user.id}>
      {/* Desk aesthetic so teaching matches the student classroom organiser */}
      <div className="theme-desk -mx-4 rounded-2xl px-4 py-5 sm:-mx-6 sm:px-6">
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {otherClasses.length ? (
                <div className="mb-2 flex flex-wrap gap-2 text-xs">
                  <Link href="/teacher" className="font-semibold text-desk-accent hover:underline">
                    All classrooms
                  </Link>
                  {otherClasses.map((c) => (
                    <Link
                      key={c.id}
                      href={`/teacher/classes/${c.id}`}
                      className="text-desk-accent hover:underline"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  href="/teacher"
                  className="text-sm font-semibold text-desk-accent hover:underline"
                >
                  ← Classrooms
                </Link>
              )}
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {klass.name}
              </h1>
              <p className="mt-1 text-base text-muted">
                Same organiser as students · plus teacher tools · {memberships.length} student
                {memberships.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <ClassroomInvitePanel
            classId={id}
            inviteCode={klass.inviteCode}
            joinUrl={joinUrl}
          />

          <details className="card rounded-xl p-4" open>
            <summary className="cursor-pointer font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
              Teacher tools
            </summary>
            <p className="mt-1 text-sm text-muted">
              Create posts, pin, edit, attach files to posts, write lessons, and upload class files.
              Students see the organiser below without these controls.
            </p>
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <ClassroomStream
                classId={id}
                posts={[]}
                lessons={[]}
                canPost
                knownTags={knownTags}
              />
              <div className="space-y-6">
                <ClassLessonEditor classId={id} knownTags={knownTags} />
                <section className="card space-y-3 rounded-xl p-4">
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
                    Upload class files
                  </h2>
                  <p className="text-xs text-muted">
                    Separate from post attachments — shows in the Files tab for everyone.
                  </p>
                  <ClassFileUpload classId={id} knownTags={knownTags} />
                </section>
                <section className="card rounded-xl p-4">
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
                    Students
                  </h2>
                  <ul className="mt-2 space-y-2 text-sm">
                    {memberships.map((m) => {
                      const label =
                        m.student.profile?.preferredName ||
                        m.student.profile?.fullName ||
                        m.student.email;
                      return (
                        <li key={m.id} className="flex items-center justify-between gap-2">
                          <Link
                            href={`/teacher/students/${m.studentId}`}
                            className="font-semibold text-ink underline-offset-2 hover:underline"
                          >
                            {label}
                          </Link>
                          <RemoveStudentButton
                            classId={id}
                            studentId={m.studentId}
                            label={label}
                          />
                        </li>
                      );
                    })}
                    {!memberships.length ? (
                      <li className="text-muted">Waiting for students to join with the invite.</li>
                    ) : null}
                  </ul>
                </section>
              </div>
            </div>
          </details>

          <section className="space-y-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
              Classroom board
            </h2>
            <p className="text-sm text-muted">
              Same as students: Stream, Timeline, Lessons, Calendar, Files, Tests — with Edit / Pin
              on posts.
            </p>
            <ClassroomOrganiser
              classId={id}
              posts={posts}
              lessons={streamLessons}
              files={fileItems}
              knownTags={knownTags}
              initialTab={initialTab}
              canManage
            />
          </section>
        </div>
      </div>
    </SessionBasketProvider>
  );
}
