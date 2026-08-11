import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertTeacherOwnsClass, requireStaff } from "@/lib/portal-access";
import { ClassroomInvitePanel } from "@/components/classroom/ClassroomInvitePanel";
import { ClassroomStream, type StreamPost } from "@/components/classroom/ClassroomStream";
import { ClassLessonEditor } from "@/components/classroom/ClassLessonEditor";
import { ClassFileUpload } from "@/components/classroom/ClassFileUpload";
import { ClassFilesList } from "@/components/classroom/ClassFilesList";
import { SessionBasketProvider } from "@/components/portal/SessionBasket";
import { classroomJoinPath } from "@/lib/invite-code";
import { getInviteOrigin } from "@/lib/classroom-actions";
import { generateInviteCode } from "@/lib/invite-code";

function authorLabel(user: {
  email: string;
  profile: { preferredName: string | null; fullName: string | null } | null;
}) {
  return user.profile?.preferredName || user.profile?.fullName || user.email;
}

export default async function TeacherClassroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaff();
  const { id } = await params;

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
      take: 14,
    }),
    prisma.resource.findMany({
      where: { classId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
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
  }));

  return (
    <SessionBasketProvider userId={session.user.id}>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {otherClasses.length ? (
              <div className="mb-2 flex flex-wrap gap-2 text-xs">
                <Link href="/teacher" className="text-muted hover:text-foreground">
                  All classrooms
                </Link>
                {otherClasses.map((c) => (
                  <Link
                    key={c.id}
                    href={`/teacher/classes/${c.id}`}
                    className="text-accent hover:underline"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            ) : (
              <Link href="/teacher" className="text-xs font-semibold text-muted hover:text-foreground">
                ← Classrooms
              </Link>
            )}
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
              {klass.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Shared classroom · {memberships.length} student
              {memberships.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <ClassroomInvitePanel
          classId={id}
          inviteCode={klass.inviteCode}
          joinUrl={joinUrl}
        />

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <ClassroomStream
            classId={id}
            posts={posts}
            canPost
            knownTags={knownTags}
          />

          <div className="space-y-8">
            <ClassLessonEditor classId={id} knownTags={knownTags} />

            <section className="card space-y-3 rounded-xl p-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                Files
              </h2>
              <p className="text-xs text-muted">
                Class materials students can reopen anytime from My Desk / classroom Files.
              </p>
              <ClassFileUpload classId={id} knownTags={knownTags} />
              <ClassFilesList
                files={files.map((f) => ({
                  id: f.id,
                  title: f.title,
                  filename: f.filename,
                  tags: f.tags || [],
                }))}
                knownTags={knownTags}
              />
            </section>

            <section className="card rounded-xl p-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                Students
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {memberships.map((m) => (
                  <li key={m.id}>
                    {m.student.profile?.preferredName ||
                      m.student.profile?.fullName ||
                      m.student.email}
                  </li>
                ))}
                {!memberships.length ? (
                  <li className="text-muted">Waiting for students to join with the invite.</li>
                ) : null}
              </ul>
            </section>

            {lessons.length ? (
              <section className="card rounded-xl p-4">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                  Recent lessons
                </h2>
                <ul className="mt-2 space-y-3">
                  {lessons.map((d) => (
                    <li key={d.id} className="border-b border-border pb-2 last:border-0">
                      <p className="font-semibold">
                        {d.day.toISOString().slice(0, 10)}
                        {d.title ? ` · ${d.title}` : ""}
                      </p>
                      {d.summary ? <p className="text-sm text-muted">{d.summary}</p> : null}
                      {d.tags?.length ? (
                        <p className="mt-1 flex flex-wrap gap-1">
                          {d.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded bg-surface px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted ring-1 ring-border"
                            >
                              {t}
                            </span>
                          ))}
                        </p>
                      ) : null}
                      {d.subEntries.length ? (
                        <ul className="mt-1 text-xs text-muted">
                          {d.subEntries.map((s) => (
                            <li key={s.id}>
                              [{s.kind}] {s.title}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </SessionBasketProvider>
  );
}
