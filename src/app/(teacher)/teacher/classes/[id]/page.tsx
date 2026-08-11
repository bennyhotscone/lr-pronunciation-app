import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertTeacherOwnsClass, requireStaff } from "@/lib/portal-access";
import { ClassTools } from "@/components/portal/ClassTools";
import { TeacherClassPosts, type PostView } from "@/components/portal/ClassPosts";
import { SessionBasketProvider } from "@/components/portal/SessionBasket";
import { portalResourceDownloadHref } from "@/lib/portal-files";

function authorLabel(user: {
  email: string;
  profile: { preferredName: string | null; fullName: string | null } | null;
}) {
  return user.profile?.preferredName || user.profile?.fullName || user.email;
}

export default async function TeacherClassPage({
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

  const [memberships, lessons, resources, homework, allStudents, rawPosts] =
    await Promise.all([
      prisma.classMembership.findMany({
        where: { classId: id, status: "ACTIVE" },
        include: { student: { include: { profile: true } } },
      }),
      prisma.lesson.findMany({
        where: { classId: id },
        orderBy: { date: "desc" },
      }),
      prisma.resource.findMany({
        where: { classId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.homework.findMany({
        where: { classId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        where: { role: "STUDENT", archivedAt: null },
        include: { profile: true },
        orderBy: { email: "asc" },
      }),
      prisma.classPost.findMany({
        where: { classId: id },
        include: {
          author: { include: { profile: true } },
          attachments: true,
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
    ]);

  const studentOptions = allStudents.map((s) => ({
    id: s.id,
    label: `${s.profile?.preferredName || s.profile?.fullName || s.email} (${s.email})`,
  }));

  const posts: PostView[] = rawPosts.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    pinnedAt: p.pinnedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    authorLabel: authorLabel(p.author),
    attachments: p.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      blobUrl: a.blobUrl,
    })),
    comments: p.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      authorLabel: authorLabel(c.author),
      parentId: c.parentId,
    })),
  }));

  return (
    <SessionBasketProvider userId={session.user.id}>
      <div>
        <Link href="/teacher" className="text-sm font-semibold text-muted hover:text-foreground">
          ← Dashboard
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {klass.name}
        </h1>
        {klass.description ? <p className="mt-2 text-muted">{klass.description}</p> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <section className="card rounded-2xl p-4">
            <h2 className="text-xs font-bold uppercase text-muted">Lessons</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {lessons.slice(0, 5).map((l) => (
                <li key={l.id}>{l.title}</li>
              ))}
              {!lessons.length ? <li className="text-muted">None yet</li> : null}
            </ul>
          </section>
          <section className="card rounded-2xl p-4">
            <h2 className="text-xs font-bold uppercase text-muted">Files</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {resources.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <a
                    href={portalResourceDownloadHref(r.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {r.title}
                  </a>
                </li>
              ))}
              {!resources.length ? <li className="text-muted">None yet</li> : null}
            </ul>
          </section>
          <section className="card rounded-2xl p-4">
            <h2 className="text-xs font-bold uppercase text-muted">Homework</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {homework.slice(0, 5).map((h) => (
                <li key={h.id}>{h.title}</li>
              ))}
              {!homework.length ? <li className="text-muted">None yet</li> : null}
            </ul>
          </section>
        </div>

        <TeacherClassPosts classId={id} posts={posts} />

        <ClassTools
          classId={id}
          students={studentOptions}
          enrolledIds={memberships.map((m) => m.studentId)}
          lessons={lessons.map((l) => ({ id: l.id, title: l.title }))}
        />
      </div>
    </SessionBasketProvider>
  );
}
