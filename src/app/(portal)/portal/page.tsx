import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveClassIdsForStudent, requireRole } from "@/lib/portal-access";
import { getAvatar } from "@/lib/avatars";
import {
  portalResourceDownloadHref,
  portalResourceReadHref,
} from "@/lib/portal-files";
import { ClassroomStream, type StreamPost } from "@/components/classroom/ClassroomStream";
import { DeskVocabRail } from "@/components/portal/DeskVocabRail";
import { compareVocabEntries } from "@/lib/vocab-sort";

function authorLabel(user: {
  email: string;
  profile: { preferredName: string | null; fullName: string | null } | null;
}) {
  return user.profile?.preferredName || user.profile?.fullName || user.email;
}

function isPdf(mime: string | null | undefined, filename: string) {
  return mime === "application/pdf" || /\.pdf$/i.test(filename);
}

export default async function MyDeskPage() {
  const session = await requireRole("STUDENT");
  const studentId = session.user.id;
  const classIds = await getActiveClassIdsForStudent(studentId);
  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId } });
  const avatar = getAvatar(profile?.avatarId || session.user.avatarId);
  const name =
    profile?.preferredName || session.user.preferredName || session.user.name || "there";

  const [classes, postsRaw, files, homework, goalsRaw, vocabRaw] = await Promise.all([
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
    prisma.goal.findMany({
      where: { studentId, status: "ACTIVE" },
      include: { checklistItems: { orderBy: { sortOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.vocabEntry.findMany({
      where: { studentId },
    }),
  ]);

  const vocabEntries = [...vocabRaw].sort(compareVocabEntries);

  const goals = [...goalsRaw].sort((a, b) => {
    const aTeach = a.source === "STUDENT_HELP" ? 1 : 0;
    const bTeach = b.source === "STUDENT_HELP" ? 1 : 0;
    if (aTeach !== bTeach) return aTeach - bTeach;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  const focusSkills = goals.filter((g) => g.source !== "STUDENT_HELP");
  const mySkills = goals.filter((g) => g.source === "STUDENT_HELP");

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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="desk-panel rounded-2xl border-desk-accent/25 p-5 ring-1 ring-desk-accent/20">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
                Always on your desk
              </p>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
                Skills we&apos;re focusing on
              </h2>
              <p className="mt-1 text-sm text-ink/60">
                This is what class and homework are aiming at — competency, not a to-do list.
              </p>
            </div>
            <Link
              href="/portal/goals"
              className="text-sm font-bold text-desk-accent underline-offset-2 hover:underline"
            >
              Full skills page →
            </Link>
          </div>

          {focusSkills.length ? (
            <div className="mt-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Teacher focus ({focusSkills.length})
              </p>
              <ul className="space-y-4">
                {focusSkills.map((g) => {
                  const total = g.checklistItems.length;
                  const done = g.checklistItems.filter((i) => i.done).length;
                  return (
                    <li
                      key={g.id}
                      className="rounded-xl border border-desk-accent/25 bg-paper px-4 py-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold text-ink">{g.title}</p>
                        <p className="text-xs font-bold text-desk-accent">
                          {total ? `${done}/${total} checks` : `${g.progressPct}%`}
                        </p>
                      </div>
                      {g.description ? (
                        <p className="mt-1 text-sm text-ink/55">{g.description}</p>
                      ) : null}
                      <div className="progress-bar mt-3">
                        <span style={{ width: `${g.progressPct}%` }} />
                      </div>
                      {total ? (
                        <ul className="mt-3 space-y-1.5">
                          {g.checklistItems.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-start gap-2 text-sm text-ink/80"
                            >
                              <span
                                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                  item.done
                                    ? "border-desk-accent bg-desk-accent text-paper"
                                    : "border-wood/40 bg-white text-transparent"
                                }`}
                                aria-hidden
                              >
                                ✓
                              </span>
                              <span className={item.done ? "text-ink/45 line-through" : ""}>
                                {item.title}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-ink/45">
                          Waiting for competency checks from your teacher.
                        </p>
                      )}
                      <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-wide text-ink/40">
                        Only your teacher can tick these off — they guide class &amp; homework
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-wood/30 bg-paper/70 px-4 py-3 text-sm text-ink/60">
              No teacher focus skills yet. When your teacher sets skills for you, they stay here so
              you always know what class and homework are building toward.
            </p>
          )}

          {mySkills.length ? (
            <div className="mt-6 space-y-3 border-t border-wood/15 pt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Extra help I requested ({mySkills.length})
              </p>
              <ul className="space-y-3">
                {mySkills.map((g) => {
                  const total = g.checklistItems.length;
                  const done = g.checklistItems.filter((i) => i.done).length;
                  return (
                    <li
                      key={g.id}
                      className="rounded-xl border border-wood/20 bg-paper/80 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold text-ink">{g.title}</p>
                        <p className="text-xs font-bold text-desk-accent">
                          {total ? `${done}/${total} checks` : `${g.progressPct}%`}
                        </p>
                      </div>
                      <div className="progress-bar mt-2">
                        <span style={{ width: `${g.progressPct}%` }} />
                      </div>
                      {total ? (
                        <ul className="mt-2 space-y-1">
                          {g.checklistItems.slice(0, 4).map((item) => (
                            <li
                              key={item.id}
                              className="flex items-start gap-2 text-sm text-ink/80"
                            >
                              <span
                                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                  item.done
                                    ? "border-desk-accent bg-desk-accent text-paper"
                                    : "border-wood/40 bg-white text-transparent"
                                }`}
                                aria-hidden
                              >
                                ✓
                              </span>
                              <span className={item.done ? "text-ink/45 line-through" : ""}>
                                {item.title}
                              </span>
                            </li>
                          ))}
                          {total > 4 ? (
                            <li className="text-xs text-ink/45">
                              +{total - 4} more on the{" "}
                              <Link href="/portal/goals" className="font-semibold text-desk-accent">
                                Skills page
                              </Link>
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                      <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-wide text-ink/40">
                        Only your teacher can tick these off
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>

        <DeskVocabRail
          targetLang={profile?.targetLang || "zh-CN"}
          entries={vocabEntries.map((e) => ({
            id: e.id,
            word: e.word,
            translation: e.translation,
            lookupCount: e.lookupCount,
            frequencyRank: e.frequencyRank,
            targetLang: e.targetLang,
          }))}
        />
      </div>

      <section className="desk-panel mt-8 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
            Your classrooms
          </h2>
          <Link
            href="/portal/join"
            className="text-sm font-bold text-desk-accent underline-offset-2 hover:underline"
          >
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
            <Link href="/portal/join" className="font-semibold text-desk-accent underline">
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
              <li key={f.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {isPdf(f.mimeType, f.filename) ? (
                  <>
                    <Link
                      href={portalResourceReadHref(f.id, "read")}
                      className="font-semibold text-ink underline-offset-2 hover:underline"
                    >
                      {f.title}
                    </Link>
                    <Link
                      href={portalResourceReadHref(f.id, "read")}
                      className="text-xs font-bold text-desk-accent"
                    >
                      Read
                    </Link>
                    <Link
                      href={portalResourceReadHref(f.id, "write")}
                      className={`text-xs font-bold ${
                        f.materialKind === "EXERCISE" ? "text-[#1f4e46]" : "text-ink/45"
                      }`}
                    >
                      Write
                    </Link>
                  </>
                ) : (
                  <a
                    href={portalResourceDownloadHref(f.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-ink underline-offset-2 hover:underline"
                  >
                    {f.title}
                  </a>
                )}
              </li>
            ))}
            {!files.length ? <li className="text-ink/45">No files yet.</li> : null}
          </ul>
        </section>

        <section className="desk-panel rounded-2xl p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
            Homework
          </h2>
          <p className="mt-1 text-xs text-ink/50">
            Homework should line up with the skills at the top of your desk.
          </p>
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
