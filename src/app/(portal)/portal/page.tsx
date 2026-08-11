import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveClassIdsForStudent, requireRole } from "@/lib/portal-access";
import { getAvatar } from "@/lib/avatars";
import { portalResourceDownloadHref } from "@/lib/portal-files";
import { ClassroomStream, type StreamPost } from "@/components/classroom/ClassroomStream";

function authorLabel(user: {
  email: string;
  profile: { preferredName: string | null; fullName: string | null } | null;
}) {
  return user.profile?.preferredName || user.profile?.fullName || user.email;
}

export default async function MyDeskPage() {
  const session = await requireRole("STUDENT");
  const studentId = session.user.id;
  const classIds = await getActiveClassIdsForStudent(studentId);
  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId } });
  const avatar = getAvatar(profile?.avatarId || session.user.avatarId);
  const name =
    profile?.preferredName || session.user.preferredName || session.user.name || "there";

  const [classes, postsRaw, files, homework] = await Promise.all([
    prisma.class.findMany({
      where: { id: { in: classIds } },
      orderBy: { name: "asc" },
    }),
    classIds.length
      ? prisma.classPost.findMany({
          where: { classId: { in: classIds } },
          include: {
            author: { include: { profile: true } },
            comments: {
              include: { author: { include: { profile: true } } },
              orderBy: { createdAt: "asc" },
            },
            class: { select: { name: true } },
          },
          orderBy: [
            { pinnedAt: { sort: "desc", nulls: "last" } },
            { createdAt: "desc" },
          ],
          take: 6,
        })
      : Promise.resolve([]),
    prisma.resource.findMany({
      where: {
        OR: [{ studentId }, ...(classIds.length ? [{ classId: { in: classIds } }] : [])],
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.homework.findMany({
      where: {
        OR: [{ studentId }, ...(classIds.length ? [{ classId: { in: classIds } }] : [])],
        status: "ASSIGNED",
      },
      orderBy: { dueAt: "asc" },
      take: 6,
      include: { class: { select: { name: true } } },
    }),
  ]);

  const posts: StreamPost[] = postsRaw.map((p) => ({
    id: p.id,
    title: `${p.title}${"class" in p && p.class ? ` · ${p.class.name}` : ""}`,
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
    <div className="desk-shell">
      <div className="flex items-center gap-4">
        <span
          className="inline-flex h-16 w-16 items-center justify-center rounded-full text-4xl shadow"
          style={{ background: avatar.bg }}
          aria-hidden
        >
          {avatar.emoji}
        </span>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
            My Desk
          </h1>
          <p className="mt-1 text-ink/60">Welcome back, {name}.</p>
        </div>
      </div>

      <section className="desk-panel mt-8 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
            Your classrooms
          </h2>
          <Link href="/join" className="text-sm font-bold text-desk-accent underline-offset-2 hover:underline">
            Join with invite code →
          </Link>
        </div>
        {classes.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {classes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/portal/classrooms/${c.id}`}
                  className="flex items-center justify-between rounded-xl border border-wood/25 bg-paper px-4 py-4 transition hover:-translate-y-0.5"
                >
                  <span className="font-semibold text-ink">{c.name}</span>
                  <span aria-hidden className="text-desk-accent">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink/55">
            You are not in a classroom yet. Ask your teacher for an invite code or link, then{" "}
            <Link href="/join" className="font-semibold text-desk-accent underline">
              join here
            </Link>
            .
          </p>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="desk-panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
              Files (easy to reopen)
            </h2>
            <Link href="/portal/resources" className="text-xs font-bold text-desk-accent">
              All files
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {files.map((f) => (
              <li key={f.id}>
                <a
                  href={portalResourceDownloadHref(f.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ink underline-offset-2 hover:underline"
                >
                  {f.title}
                </a>
              </li>
            ))}
            {!files.length ? <li className="text-ink/45">No files yet.</li> : null}
          </ul>
        </section>

        <section className="desk-panel rounded-2xl p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
            Homework
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {homework.map((h) => (
              <li key={h.id}>
                <p className="font-semibold text-ink">{h.title}</p>
                <p className="text-xs text-ink/50">
                  {h.class?.name || "Just for you"}
                  {h.dueAt ? ` · due ${h.dueAt.toLocaleDateString()}` : ""}
                </p>
              </li>
            ))}
            {!homework.length ? <li className="text-ink/45">No open homework.</li> : null}
          </ul>
        </section>
      </div>

      {posts.length ? (
        <section className="mt-8">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
            Recent stream
          </h2>
          <ClassroomStream classId="" posts={posts} canPost={false} />
        </section>
      ) : null}
    </div>
  );
}
