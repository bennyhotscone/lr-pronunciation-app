import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, studentCanAccessClass } from "@/lib/portal-access";
import { ClassroomStream, type StreamPost } from "@/components/classroom/ClassroomStream";
import { ClassFilesList } from "@/components/classroom/ClassFilesList";
import { portalResourceDownloadHref } from "@/lib/portal-files";

function authorLabel(user: {
  email: string;
  profile: { preferredName: string | null; fullName: string | null } | null;
}) {
  return user.profile?.preferredName || user.profile?.fullName || user.email;
}

export default async function StudentClassroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("STUDENT");
  const { id } = await params;
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
      take: 20,
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
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/portal" className="text-sm font-semibold text-muted hover:text-foreground">
          ← My Desk
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {klass.name}
        </h1>
        <p className="mt-1 text-sm text-muted">Stream, lessons, and files</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <ClassroomStream
          classId={id}
          posts={posts}
          canPost={false}
          knownTags={knownTags}
        />

        <div className="space-y-6">
          <section className="card rounded-xl p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Files
            </h2>
            <p className="mt-1 text-xs text-muted">
              Download again anytime — these stay in your classroom.
            </p>
            <div className="mt-3">
              <ClassFilesList
                files={files.map((f) => ({
                  id: f.id,
                  title: f.title,
                  filename: f.filename,
                  tags: f.tags || [],
                }))}
                knownTags={knownTags}
              />
            </div>
            <Link
              href="/portal/resources"
              className="mt-3 inline-block text-xs font-bold text-accent underline-offset-2 hover:underline"
            >
              All my files →
            </Link>
          </section>

          <section className="card rounded-xl p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Lessons
            </h2>
            <ul className="mt-3 space-y-3">
              {lessons.map((d) => (
                <li key={d.id} className="border-b border-border pb-3 last:border-0">
                  <p className="font-semibold">
                    {d.day.toISOString().slice(0, 10)}
                    {d.title ? ` · ${d.title}` : ""}
                  </p>
                  {d.summary ? <p className="mt-1 text-sm text-muted">{d.summary}</p> : null}
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
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                      {d.subEntries.map((s) => (
                        <li key={s.id}>
                          <span className="text-xs font-bold uppercase text-accent">
                            {s.kind}
                          </span>{" "}
                          {s.title}
                          {s.body ? <span> — {s.body}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {d.attachments.length ? (
                    <ul className="mt-2 text-sm">
                      {d.attachments.map((a) => (
                        <li key={a.id} className="text-accent">
                          {a.resourceId ? (
                            <a
                              href={portalResourceDownloadHref(a.resourceId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline-offset-2 hover:underline"
                            >
                              {a.filename}
                            </a>
                          ) : (
                            <span>{a.filename}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
              {!lessons.length ? (
                <li className="text-sm text-muted">No lessons yet.</li>
              ) : null}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
