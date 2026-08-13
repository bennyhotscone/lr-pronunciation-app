import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveClassIdsForStudent, requireRole } from "@/lib/portal-access";
import { getAvatar } from "@/lib/avatars";
import {
  portalResourceDownloadHref,
  portalResourceReadHref,
} from "@/lib/portal-files";
import { groupByMaterialKind } from "@/lib/material-kind";
import type { StreamLesson, StreamPost } from "@/components/classroom/ClassroomStream";
import {
  ClassroomOrganiser,
  type OrganiserTab,
} from "@/components/classroom/ClassroomOrganiser";
import { TagExplorePanel } from "@/components/classroom/TagExplorePanel";
import { DeskVocabRail } from "@/components/portal/DeskVocabRail";
import { FreeStoryPracticeCard } from "@/components/story/FreeStoryPracticeCard";
import { LearningPyramid } from "@/components/portal/LearningPyramid";
import { DeskVocabPracticeCard } from "@/components/portal/DeskVocabPracticeCard";
import { ClassMoneyBadge } from "@/components/portal/ClassMoneyBadge";
import { compareVocabEntries } from "@/lib/vocab-sort";
import { buildFreeLessonSummary } from "@/lib/lesson-summary";
import { normalizeTag } from "@/lib/info-tag-links";
import { isStoryWizardStep, stepLabel } from "@/lib/story/types";
import { utcDayBounds } from "@/lib/vocab-practice";
import { getOrCreateWalletBalance } from "@/lib/class-money-actions";

function storyStatusLabel(status: string): string {
  switch (status) {
    case "PLANNING":
      return "Planning";
    case "AWAITING_PLAN_APPROVAL":
      return "Waiting for plan approval";
    case "DRAFTING":
      return "Drafting";
    case "REVISING":
      return "Revising";
    default:
      return status;
  }
}

function authorLabel(user: {
  email: string;
  profile: { preferredName: string | null; fullName: string | null } | null;
}) {
  return user.profile?.preferredName || user.profile?.fullName || user.email;
}

function isPdf(mime: string | null | undefined, filename: string) {
  return mime === "application/pdf" || /\.pdf$/i.test(filename);
}

export default async function MyDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; tab?: string; day?: string }>;
}) {
  const session = await requireRole("STUDENT");
  const studentId = session.user.id;
  const classIds = await getActiveClassIdsForStudent(studentId);
  /** Students are in one class at a time — desk is that classroom. */
  const classId = classIds[0] ?? null;
  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId } });
  const avatar = getAvatar(profile?.avatarId || session.user.avatarId);
  const name =
    profile?.preferredName || session.user.preferredName || session.user.name || "there";

  const sp = await searchParams;
  const activeTag = sp.tag ? normalizeTag(sp.tag) : null;
  const initialTab = (
    ["stream", "timeline", "lessons", "calendar", "files", "tests"] as const
  ).includes(sp.tab as OrganiserTab)
    ? (sp.tab as OrganiserTab)
    : "stream";

  const [klass, postsRaw, lessons, classFiles, deskFiles, homework, goalsRaw, vocabRaw, classTags, storyAttempts, vocabPacks, packsToday, moneyBalance] =
    await Promise.all([
      classId
        ? prisma.class.findFirst({ where: { id: classId, archivedAt: null } })
        : Promise.resolve(null),
      classId
        ? prisma.classPost.findMany({
            where: { classId },
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
          })
        : Promise.resolve([]),
      classId
        ? prisma.classLesson.findMany({
            where: { classId },
            include: { subEntries: { orderBy: { sortOrder: "asc" } }, attachments: true },
            orderBy: { day: "desc" },
            take: 80,
          })
        : Promise.resolve([]),
      classId
        ? prisma.resource.findMany({
            where: { classId },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      prisma.resource.findMany({
        where: {
          OR: [{ studentId }, ...(classId ? [{ classId }] : [])],
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.homework.findMany({
        where: {
          OR: [{ studentId }, ...(classId ? [{ classId }] : [])],
          status: "ASSIGNED",
        },
        orderBy: { dueAt: "asc" },
        take: 6,
        include: {
          class: { select: { name: true } },
          storyAssignment: { select: { id: true } },
        },
      }),
      prisma.goal.findMany({
        where: { studentId, status: "ACTIVE" },
        include: { checklistItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.vocabEntry.findMany({
        where: { studentId },
      }),
      classId
        ? prisma.classTag.findMany({
            where: { classId },
            orderBy: { name: "asc" },
            select: { name: true },
          })
        : Promise.resolve([]),
      prisma.storyAttempt.findMany({
        where: {
          studentId,
          status: {
            in: ["PLANNING", "AWAITING_PLAN_APPROVAL", "DRAFTING", "REVISING"],
          },
        },
        include: {
          assignment: { select: { title: true, isFreePractice: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      prisma.vocabPracticePack.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
          completedAt: true,
          vocabUsed: true,
        },
      }),
      (() => {
        const { start, end } = utcDayBounds();
        return prisma.vocabPracticePack.count({
          where: { studentId, createdAt: { gte: start, lt: end } },
        });
      })(),
      getOrCreateWalletBalance(studentId),
    ]);

  const vocabEntries = [...vocabRaw].sort(compareVocabEntries);

  const goals = [...goalsRaw].sort((a, b) => {
    const aTeach = a.source === "STUDENT_HELP" ? 1 : 0;
    const bTeach = b.source === "STUDENT_HELP" ? 1 : 0;
    if (aTeach !== bTeach) return aTeach - bTeach;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

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
      materialKind: a.materialKind,
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
      materialKind: a.materialKind,
    })),
  }));

  const knownTags = classTags.map((t) => t.name);

  return (
    <div className="desk-shell">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
            <p className="mt-1 text-ink/60">
              Welcome back, {name}.
              {klass ? (
                <>
                  {" "}
                  <span className="text-ink/45">·</span>{" "}
                  <span className="font-semibold text-ink/70">{klass.name}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <ClassMoneyBadge balance={moneyBalance} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="desk-panel rounded-2xl border-desk-accent/25 p-5 ring-1 ring-desk-accent/20">
          <LearningPyramid
            compact
            goals={goals.map((g) => ({
              id: g.id,
              title: g.title,
              description: g.description,
              progressPct: g.progressPct,
              source: g.source,
              pyramidTier: g.pyramidTier,
              checklistItems: g.checklistItems,
            }))}
          />
        </section>

        <div className="space-y-6">
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
          <DeskVocabPracticeCard
            packsToday={packsToday}
            vocabCount={vocabEntries.length}
            recentPacks={vocabPacks.map((p) => ({
              id: p.id,
              title: p.title,
              createdAt: p.createdAt.toISOString(),
              completedAt: p.completedAt?.toISOString() ?? null,
              vocabUsed: p.vocabUsed,
            }))}
          />
        </div>
      </div>

      {classId && klass ? (
        <section className="mt-8 space-y-6">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
              Class board
            </h2>
            <p className="mt-1 text-sm text-ink/55">
              Stream, lessons, calendar, and files for {klass.name}.
            </p>
          </div>

          {activeTag ? (
            <TagExplorePanel
              classId={classId}
              tag={activeTag}
              posts={postsRaw.map((p) => ({ id: p.id, title: p.title, tags: p.tags || [] }))}
              lessons={lessons.map((l) => ({
                id: l.id,
                title: l.title,
                day: l.day,
                tags: l.tags || [],
              }))}
              files={classFiles.map((f) => ({ id: f.id, title: f.title, tags: f.tags || [] }))}
            />
          ) : null}

          <ClassroomOrganiser
            classId={classId}
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
              ? classFiles.filter((f) => (f.tags || []).map(normalizeTag).includes(activeTag))
              : classFiles
            ).map((f) => ({
              id: f.id,
              title: f.title,
              filename: f.filename,
              tags: f.tags || [],
              mimeType: f.mimeType,
              materialKind: f.materialKind,
            }))}
            knownTags={knownTags}
            initialTab={initialTab}
          />
        </section>
      ) : (
        <section className="desk-panel mt-8 rounded-2xl p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
            Join your class
          </h2>
          <p className="mt-3 text-sm text-ink/55">
            You are not in a classroom yet. Ask your teacher for an invite code or link, then{" "}
            <Link href="/portal/join" className="font-semibold text-desk-accent underline">
              join here
            </Link>
            .
          </p>
          <Link
            href="/portal/join"
            className="mt-4 inline-flex rounded-xl bg-desk-accent px-4 py-2.5 text-sm font-bold text-paper"
          >
            Join with invite code
          </Link>
        </section>
      )}

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
          {deskFiles.length ? (
            <div className="space-y-4 text-sm">
              {groupByMaterialKind(deskFiles).map((section) => (
                <div key={section.kind}>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink/50">
                    {section.label}
                  </p>
                  <ul className="space-y-2">
                    {section.items.map((f) => (
                      <li
                        key={f.id}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
                      >
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
                                f.materialKind === "EXERCISE"
                                  ? "text-[#1f4e46]"
                                  : "text-ink/45"
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
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink/45">No files yet.</p>
          )}
        </section>

        <section className="desk-panel rounded-2xl p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
            Homework
          </h2>
          <p className="mt-1 text-xs text-ink/50">
            Homework should line up with the learning targets at the top of your desk.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {homework.map((h) => (
              <li key={h.id}>
                {h.storyAssignment ? (
                  <Link
                    href={`/portal/stories/open?homeworkId=${h.id}`}
                    className="font-semibold text-desk-accent underline-offset-2 hover:underline"
                  >
                    Guided Story: {h.title}
                  </Link>
                ) : (
                  <p className="font-semibold text-ink">{h.title}</p>
                )}
                <p className="text-xs text-ink/50">
                  {h.class?.name || "Just for you"}
                  {h.dueAt ? ` · due ${h.dueAt.toLocaleDateString()}` : ""}
                </p>
              </li>
            ))}
            {!homework.length ? <li className="text-ink/45">No open homework.</li> : null}
          </ul>
        </section>

        <section className="desk-panel rounded-2xl p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
            Stories in progress
          </h2>
          <p className="mt-1 text-xs text-ink/50">
            Pick up where you left off — homework stories and free practice.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {storyAttempts.map((a) => {
              const title =
                a.studentTitle?.trim() ||
                a.assignment.title ||
                "Untitled story";
              const step =
                a.currentStep && isStoryWizardStep(a.currentStep)
                  ? stepLabel(a.currentStep)
                  : null;
              return (
                <li key={a.id}>
                  <Link
                    href={`/portal/stories/${a.id}`}
                    className="font-semibold text-desk-accent underline-offset-2 hover:underline"
                  >
                    Continue: {title}
                  </Link>
                  <p className="text-xs text-ink/50">
                    {a.assignment.isFreePractice ? "Free practice" : "Guided Story"}
                    {" · "}
                    {storyStatusLabel(a.status)}
                    {step ? ` · ${step}` : ""}
                  </p>
                </li>
              );
            })}
            {!storyAttempts.length ? (
              <li className="text-ink/45">No stories in progress.</li>
            ) : null}
          </ul>
        </section>

        <FreeStoryPracticeCard />
      </div>
    </div>
  );
}
