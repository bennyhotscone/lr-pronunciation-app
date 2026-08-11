import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, studentCanAccessClass } from "@/lib/portal-access";
import { ClassroomStream, type StreamPost } from "@/components/classroom/ClassroomStream";
import { ClassFilesList } from "@/components/classroom/ClassFilesList";
import { InfoTag } from "@/components/classroom/InfoTag";
import { TagExplorePanel } from "@/components/classroom/TagExplorePanel";
import { portalResourceDownloadHref } from "@/lib/portal-files";
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
  searchParams: Promise<{ tag?: string }>;
}) {
  const session = await requireRole("STUDENT");
  const { id } = await params;
  const sp = await searchParams;
  const activeTag = sp.tag ? normalizeTag(sp.tag) : null;

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

  const filteredPosts = activeTag
    ? posts.filter((p) => (p.tags || []).map(normalizeTag).includes(activeTag))
    : posts;
  const filteredLessons = activeTag
    ? lessons.filter((l) => (l.tags || []).map(normalizeTag).includes(activeTag))
    : lessons;
  const filteredFiles = activeTag
    ? files.filter((f) => (f.tags || []).map(normalizeTag).includes(activeTag))
    : files;

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
          Stream · lessons · files — click a tag for free study links
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

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <ClassroomStream
          classId={id}
          posts={filteredPosts}
          canPost={false}
          knownTags={knownTags}
        />

        <div className="space-y-6">
          <section className="card rounded-xl p-5">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
              Files
            </h2>
            <p className="mt-1 text-sm text-muted">
              Download again anytime — these stay in your classroom.
            </p>
            <div className="mt-3">
              <ClassFilesList
                files={filteredFiles.map((f) => ({
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
              className="mt-3 inline-block text-sm font-bold text-desk-accent underline-offset-2 hover:underline"
            >
              All my files →
            </Link>
          </section>

          <section className="card rounded-xl p-5">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
              Lessons
            </h2>
            <ul className="mt-3 space-y-5">
              {filteredLessons.map((d) => {
                const summary = buildFreeLessonSummary({
                  title: d.title,
                  summary: d.summary,
                  subEntries: d.subEntries,
                  tags: d.tags || [],
                });
                return (
                  <li key={d.id} className="border-b border-border pb-5 last:border-0 last:pb-0">
                    <p className="font-semibold text-ink">
                      {d.day.toISOString().slice(0, 10)}
                      {d.title ? ` · ${d.title}` : ""}
                    </p>

                    <div className="mt-3 rounded-lg border border-border bg-[#f3f2ee] p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
                        Summary
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-ink">{summary}</p>
                      <p className="mt-2 text-[0.7rem] text-muted">
                        Free summary from the lesson notes — no paid AI.
                      </p>
                    </div>

                    {(d.tags || []).length ? (
                      <div className="mt-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">
                          Info tags
                        </p>
                        <p className="mt-1 flex flex-wrap gap-1.5">
                          {d.tags.map((t) => (
                            <InfoTag
                              key={t}
                              tag={t}
                              classId={id}
                              active={activeTag === normalizeTag(t)}
                            />
                          ))}
                        </p>
                      </div>
                    ) : null}

                    {d.subEntries.length ? (
                      <ul className="mt-3 space-y-1.5 text-sm text-muted">
                        {d.subEntries.map((s) => (
                          <li key={s.id}>
                            <span className="text-xs font-bold uppercase text-desk-accent">
                              {s.kind}
                            </span>{" "}
                            <span className="text-ink">{s.title}</span>
                            {s.body ? <span> — {s.body}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {d.attachments.length ? (
                      <ul className="mt-2 text-sm">
                        {d.attachments.map((a) => (
                          <li key={a.id}>
                            {a.resourceId ? (
                              <a
                                href={portalResourceDownloadHref(a.resourceId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-desk-accent underline-offset-2 hover:underline"
                              >
                                {a.filename}
                              </a>
                            ) : (
                              <span className="text-ink">{a.filename}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
              {!filteredLessons.length ? (
                <li className="text-sm text-muted">
                  {activeTag ? `No lessons tagged “${activeTag}”.` : "No lessons yet."}
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
