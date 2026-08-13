"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  commentOnClassPost,
  teacherTogglePinPost,
  teacherUpdateClassPost,
} from "@/lib/classroom-actions";
import { TagFilterBar, TagPicker } from "@/components/classroom/TagPicker";
import { InfoTag } from "@/components/classroom/InfoTag";
import {
  ClassFilesList,
  type ClassFileItem,
} from "@/components/classroom/ClassFilesList";
import type { StreamLesson, StreamPost } from "@/components/classroom/ClassroomStream";
import { TopicHelpButton } from "@/components/classroom/TopicHelpButton";
import { BasketAttachFields } from "@/components/portal/SessionBasket";
import { MaterialKindBadge } from "@/components/classroom/MaterialKindPicker";
import { FilePreviewThumb } from "@/components/classroom/FilePreviewThumb";
import { groupByMaterialKind } from "@/lib/material-kind";

export type OrganiserTab =
  | "stream"
  | "timeline"
  | "lessons"
  | "calendar"
  | "files"
  | "tests";

const TABS: { id: OrganiserTab; label: string; blurb: string }[] = [
  { id: "stream", label: "Stream", blurb: "Posts and lesson cards together" },
  { id: "timeline", label: "Timeline", blurb: "Newest first, compact" },
  { id: "lessons", label: "Lessons", blurb: "All lesson writeups" },
  { id: "calendar", label: "Calendar", blurb: "Find a lesson by day" },
  { id: "files", label: "Files", blurb: "Downloads with previews" },
  {
    id: "tests",
    label: "Tests",
    blurb: "Quizzes and exams — download or take in the portal",
  },
];

function resourceHref(resourceId: string) {
  return `/api/portal/resources/${resourceId}/download`;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function formatDay(iso: string) {
  const key = iso.slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

type FeedItem =
  | { kind: "post"; sortAt: number; pinned: boolean; post: StreamPost }
  | { kind: "lesson"; sortAt: number; pinned: boolean; lesson: StreamLesson };

function buildFeed(posts: StreamPost[], lessons: StreamLesson[]): FeedItem[] {
  return [
    ...posts.map((post) => ({
      kind: "post" as const,
      sortAt: new Date(post.createdAt).getTime(),
      pinned: Boolean(post.pinnedAt),
      post,
    })),
    ...lessons.map((lesson) => ({
      kind: "lesson" as const,
      sortAt: new Date(lesson.day || lesson.createdAt).getTime(),
      pinned: false,
      lesson,
    })),
  ].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.sortAt - a.sortAt;
  });
}

function AttachmentChip({
  filename,
  mimeType,
  resourceId,
  href: hrefOverride,
  materialKind,
}: {
  filename: string;
  mimeType: string;
  resourceId: string | null;
  href?: string | null;
  materialKind?: string | null;
}) {
  const href = hrefOverride || (resourceId ? resourceHref(resourceId) : null);
  const inner = (
    <>
      <FilePreviewThumb src={href} filename={filename} mimeType={mimeType} className="h-14 w-11" />
      <span className="min-w-0 flex-1">
        <span className="block break-all text-sm font-semibold leading-snug text-ink group-hover:text-desk-accent">
          {filename}
        </span>
        {materialKind ? (
          <span className="mt-0.5 inline-block">
            <MaterialKindBadge kind={materialKind} />
          </span>
        ) : null}
      </span>
    </>
  );
  if (!href) {
    return (
      <span className="flex items-center gap-2 rounded-lg border border-border bg-[#faf9f6] p-1.5 pr-3">
        {inner}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-lg border border-border bg-[#faf9f6] p-1.5 pr-3 transition hover:border-desk-accent/40 hover:bg-white"
    >
      {inner}
    </a>
  );
}

function GroupedAttachments({
  attachments,
}: {
  attachments: {
    id: string;
    filename: string;
    mimeType: string;
    resourceId?: string | null;
    blobUrl?: string;
    materialKind?: string | null;
  }[];
}) {
  const sections = groupByMaterialKind(attachments);
  if (!sections.length) return null;
  return (
    <div className="mt-4 space-y-3">
      {sections.map((section) => (
        <div key={section.kind}>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            {section.label}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {section.items.map((a) => (
              <li key={a.id}>
                <AttachmentChip
                  filename={a.filename}
                  mimeType={a.mimeType}
                  resourceId={a.resourceId ?? null}
                  href={a.blobUrl || null}
                  materialKind={a.materialKind}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PostCard({
  post,
  classId,
  tagLinks,
  canManage = false,
  knownTags = [],
}: {
  post: StreamPost;
  classId: string;
  tagLinks: boolean;
  canManage?: boolean;
  knownTags?: string[];
}) {
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <article className="card rounded-xl p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <div className="mb-1 flex flex-wrap gap-1.5">
          {post.pinnedAt ? (
            <span className="inline-block rounded bg-accent/20 px-2 py-0.5 text-xs font-bold">
              Pinned
            </span>
          ) : null}
          <span className="inline-block rounded bg-[#f3f2ee] px-2 py-0.5 text-xs font-bold text-muted ring-1 ring-border">
            Post
          </span>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="text-xs font-bold text-desk-accent"
              onClick={() => {
                setEditing((v) => !v);
                setEditTitle(post.title);
                setEditBody(post.body);
                setMsg(null);
              }}
            >
              {editing ? "Cancel" : "Edit"}
            </button>
            <form
              action={(fd) => {
                startTransition(async () => {
                  await teacherTogglePinPost(fd);
                });
              }}
            >
              <input type="hidden" name="postId" value={post.id} />
              <button type="submit" className="text-xs font-bold text-desk-accent">
                {post.pinnedAt ? "Unpin" : "Pin"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
      <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
        {post.title}
      </h3>
      <p className="text-xs text-muted">
        {post.authorLabel} · {new Date(post.createdAt).toLocaleString()}
      </p>
      {post.tags?.length ? (
        <p className="mt-2 flex flex-wrap gap-1">
          {post.tags.map((t) =>
            tagLinks ? (
              <InfoTag key={t} tag={t} classId={classId} />
            ) : (
              <span
                key={t}
                className="rounded px-1.5 py-0.5 text-[0.7rem] font-semibold ring-1 ring-border"
              >
                {t}
              </span>
            ),
          )}
        </p>
      ) : null}
      {canManage && editing ? (
        <form
          className="mt-3 space-y-2 rounded-lg border border-border bg-[#faf9f6] p-3"
          action={(fd) => {
            setMsg(null);
            startTransition(async () => {
              const res = await teacherUpdateClassPost(fd);
              if (res?.error) setMsg(res.error);
              else {
                setMsg("Saved.");
                setEditing(false);
              }
            });
          }}
        >
          <input type="hidden" name="postId" value={post.id} />
          <BasketAttachFields />
          <input
            name="title"
            required
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            name="body"
            required
            rows={4}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
          <TagPicker
            classId={classId}
            knownTags={knownTags}
            title={editTitle}
            body={editBody}
            initialTags={post.tags}
          />
          <p className="text-xs text-muted">
            Select basket files above (Teacher tools) to attach more files to this post.
          </p>
          <button type="submit" className="btn-primary rounded px-3 py-1.5 text-xs font-bold">
            Save changes
          </button>
          {msg ? <p className="text-sm text-success">{msg}</p> : null}
        </form>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{post.body}</p>
      )}
      {post.attachments?.length ? (
        <GroupedAttachments attachments={post.attachments} />
      ) : null}
      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs font-bold uppercase text-muted">Comments</p>
        <ul className="mt-2 space-y-2">
          {post.comments.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <span className="text-xs font-semibold text-muted">{c.authorLabel}</span>
              <p>{c.body}</p>
            </li>
          ))}
          {!post.comments.length ? (
            <li className="text-sm text-muted">No comments yet.</li>
          ) : null}
        </ul>
        <form
          className="mt-2 flex gap-2"
          action={(fd) => {
            startTransition(async () => {
              await commentOnClassPost(fd);
            });
          }}
        >
          <input type="hidden" name="postId" value={post.id} />
          <input
            name="body"
            required
            placeholder="Write a reply…"
            className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
          />
          <button type="submit" className="btn-secondary rounded px-3 py-2 text-xs font-bold">
            Reply
          </button>
        </form>
      </div>
    </article>
  );
}

function LessonCard({
  lesson,
  classId,
  tagLinks,
  big = false,
  idPrefix = "lesson",
}: {
  lesson: StreamLesson;
  classId: string;
  tagLinks: boolean;
  big?: boolean;
  idPrefix?: string;
}) {
  return (
    <article
      id={`${idPrefix}-${lesson.id}`}
      className={`card rounded-xl ${big ? "border-desk-accent/25 p-5 sm:p-6" : "p-4 sm:p-5"}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-block rounded bg-desk-accent/15 px-2 py-0.5 text-xs font-bold text-desk-accent ring-1 ring-desk-accent/30">
          Lesson
        </span>
        <span className="text-xs font-semibold text-muted">{formatDay(lesson.day)}</span>
      </div>
      <h3
        className={`font-[family-name:var(--font-display)] font-semibold text-ink ${
          big ? "text-2xl sm:text-3xl" : "text-xl"
        }`}
      >
        {lesson.title || "Class lesson"}
      </h3>

      <div
        className={`mt-4 rounded-lg border border-border bg-[#f3f2ee] ${
          big ? "p-4" : "p-3"
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">Summary</p>
        <p
          className={`mt-1 leading-relaxed text-ink ${big ? "text-base" : "text-sm"}`}
        >
          {lesson.summary}
        </p>
      </div>

      {lesson.tags?.length ? (
        <p className="mt-3 flex flex-wrap gap-1.5">
          {lesson.tags.map((t) =>
            tagLinks ? (
              <InfoTag key={t} tag={t} classId={classId} />
            ) : (
              <span
                key={t}
                className="rounded px-1.5 py-0.5 text-[0.7rem] font-semibold ring-1 ring-border"
              >
                {t}
              </span>
            ),
          )}
        </p>
      ) : null}

      {lesson.subEntries.length ? (
        <ul className={`mt-4 space-y-2 ${big ? "text-base" : "text-sm"} text-muted`}>
          {lesson.subEntries.map((s) => (
            <li key={s.id}>
              <span className="text-xs font-bold uppercase text-desk-accent">{s.kind}</span>{" "}
              <span className="text-ink">{s.title}</span>
              {s.body ? <span> — {s.body}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {lesson.attachments.length ? (
        <GroupedAttachments attachments={lesson.attachments} />
      ) : null}

      <TopicHelpButton
        classId={classId}
        topics={[
          ...(lesson.tags || []),
          lesson.title || "",
        ]}
        defaultTopic={(lesson.tags && lesson.tags[0]) || lesson.title || undefined}
      />
    </article>
  );
}

function MonthCalendar({
  lessons,
  selectedDay,
  onSelectDay,
}: {
  lessons: StreamLesson[];
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const byDay = useMemo(() => {
    const map = new Map<string, StreamLesson[]>();
    for (const l of lessons) {
      const k = dayKey(l.day);
      const list = map.get(k) || [];
      list.push(l);
      map.set(k, list);
    }
    return map;
  }, [lessons]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const label = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-sm font-bold text-desk-accent ring-1 ring-border hover:bg-[#f3f2ee]"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          ←
        </button>
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
          {label}
        </h3>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-sm font-bold text-desk-accent ring-1 ring-border hover:bg-[#f3f2ee]"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] font-bold uppercase text-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="min-h-14 rounded-md bg-transparent" />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const has = byDay.has(iso);
          const count = byDay.get(iso)?.length || 0;
          const selected = selectedDay === iso;
          const isToday =
            today.getFullYear() === year &&
            today.getMonth() === month &&
            today.getDate() === day;
          return (
            <button
              key={iso}
              type="button"
              disabled={!has}
              onClick={() => onSelectDay(iso)}
              className={`min-h-14 rounded-md p-1 text-left transition ${
                selected
                  ? "bg-desk-accent text-white"
                  : has
                    ? "bg-[#f3f2ee] text-ink ring-1 ring-desk-accent/30 hover:bg-desk-accent/10"
                    : "bg-[#faf9f6] text-muted"
              } ${isToday && !selected ? "ring-1 ring-ink/30" : ""} ${
                !has ? "cursor-default opacity-70" : ""
              }`}
            >
              <span className="block text-sm font-semibold">{day}</span>
              {has ? (
                <span
                  className={`mt-1 block text-[0.65rem] font-bold ${
                    selected ? "text-white/90" : "text-desk-accent"
                  }`}
                >
                  {count} lesson{count === 1 ? "" : "s"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ClassroomOrganiser({
  classId,
  posts,
  lessons,
  files,
  knownTags = [],
  initialTab = "stream",
  canManage = false,
}: {
  classId: string;
  posts: StreamPost[];
  lessons: StreamLesson[];
  files: ClassFileItem[];
  knownTags?: string[];
  initialTab?: OrganiserTab;
  /** Teacher/admin: edit, pin, attach files on posts. */
  canManage?: boolean;
}) {
  const [tab, setTab] = useState<OrganiserTab>(initialTab);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as OrganiserTab | null;
    if (t && TABS.some((x) => x.id === t)) setTab(t);
    const day = params.get("day");
    if (day) {
      setSelectedDay(day);
      if (!t) setTab("calendar");
    }
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>(knownTags);
    for (const p of posts) for (const t of p.tags || []) s.add(t);
    for (const l of lessons) for (const t of l.tags || []) s.add(t);
    for (const f of files) for (const t of f.tags || []) s.add(t);
    return [...s].sort();
  }, [posts, lessons, files, knownTags]);

  const filteredPosts = useMemo(
    () =>
      filterTag ? posts.filter((p) => (p.tags || []).includes(filterTag)) : posts,
    [posts, filterTag],
  );
  const filteredLessons = useMemo(
    () =>
      filterTag
        ? lessons.filter((l) => (l.tags || []).includes(filterTag))
        : lessons,
    [lessons, filterTag],
  );

  const streamFeed = useMemo(
    () => buildFeed(filteredPosts, filteredLessons),
    [filteredPosts, filteredLessons],
  );

  const lessonsNewest = useMemo(
    () =>
      [...filteredLessons].sort(
        (a, b) => new Date(b.day).getTime() - new Date(a.day).getTime(),
      ),
    [filteredLessons],
  );

  const dayLessons = useMemo(() => {
    if (!selectedDay) return [];
    return filteredLessons.filter((l) => dayKey(l.day) === selectedDay);
  }, [filteredLessons, selectedDay]);

  function goTab(next: OrganiserTab, opts?: { day?: string; lessonId?: string }) {
    setTab(next);
    if (opts?.day !== undefined) setSelectedDay(opts.day);
    if (opts?.lessonId) {
      setExpandedId(opts.lessonId);
      requestAnimationFrame(() => {
        document.getElementById(`lesson-${opts.lessonId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      if (opts?.day) url.searchParams.set("day", opts.day);
      else url.searchParams.delete("day");
      window.history.replaceState({}, "", url.toString());
    }
  }

  const activeBlurb = TABS.find((t) => t.id === tab)?.blurb;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div
          role="tablist"
          aria-label="Classroom organiser"
          className="flex flex-wrap gap-1.5 border-b border-border pb-3"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            let count = 0;
            if (t.id === "stream" || t.id === "timeline") count = streamFeed.length;
            else if (t.id === "lessons") count = lessonsNewest.length;
            else if (t.id === "calendar") count = filteredLessons.length;
            else if (t.id === "files") count = files.length;
            else if (t.id === "tests") count = 0;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => goTab(t.id)}
                className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-desk-accent text-white"
                    : "bg-[#f3f2ee] text-ink ring-1 ring-border hover:ring-desk-accent"
                }`}
              >
                {t.label}
                <span
                  className={`ml-1.5 text-xs font-semibold ${
                    active ? "text-white/80" : "text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {activeBlurb ? <p className="text-sm text-muted">{activeBlurb}</p> : null}
      </div>

      {tab !== "files" && tab !== "tests" ? (
        <TagFilterBar tags={allTags} active={filterTag} onChange={setFilterTag} />
      ) : null}

      {tab === "stream" ? (
        <ul className="space-y-4">
          {streamFeed.map((item) =>
            item.kind === "post" ? (
              <li key={`post-${item.post.id}`}>
                <PostCard
                  post={item.post}
                  classId={classId}
                  tagLinks={!canManage}
                  canManage={canManage}
                  knownTags={knownTags}
                />
              </li>
            ) : (
              <li key={`lesson-${item.lesson.id}`}>
                <LessonCard
                  lesson={item.lesson}
                  classId={classId}
                  tagLinks
                  big
                />
              </li>
            ),
          )}
          {!streamFeed.length ? (
            <li className="text-sm text-muted">
              Nothing in the stream{filterTag ? ` tagged “${filterTag}”` : " yet"}.
            </li>
          ) : null}
        </ul>
      ) : null}

      {tab === "timeline" ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-[#faf9f6]">
          {streamFeed.map((item) => {
            const id =
              item.kind === "post" ? `post-${item.post.id}` : `lesson-${item.lesson.id}`;
            const open = expandedId === id;
            const title =
              item.kind === "post"
                ? item.post.title
                : item.lesson.title || "Class lesson";
            const when =
              item.kind === "post"
                ? new Date(item.post.createdAt).toLocaleString()
                : formatDay(item.lesson.day);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : id)}
                  className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-white"
                >
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase ${
                      item.kind === "lesson"
                        ? "bg-desk-accent/15 text-desk-accent"
                        : "bg-[#ebe8e0] text-muted"
                    }`}
                  >
                    {item.kind}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{title}</span>
                    <span className="block text-xs text-muted">{when}</span>
                  </span>
                  <span className="text-xs font-bold text-desk-accent">
                    {open ? "Hide" : "Open"}
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-border bg-white px-3 py-4">
                    {item.kind === "post" ? (
                      <PostCard
                  post={item.post}
                  classId={classId}
                  tagLinks={!canManage}
                  canManage={canManage}
                  knownTags={knownTags}
                />
                    ) : (
                      <LessonCard lesson={item.lesson} classId={classId} tagLinks big />
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
          {!streamFeed.length ? (
            <li className="px-3 py-4 text-sm text-muted">No timeline items yet.</li>
          ) : null}
        </ul>
      ) : null}

      {tab === "lessons" ? (
        <ul className="space-y-4">
          {lessonsNewest.map((lesson) => (
            <li key={lesson.id}>
              <LessonCard lesson={lesson} classId={classId} tagLinks big />
            </li>
          ))}
          {!lessonsNewest.length ? (
            <li className="text-sm text-muted">
              No lessons{filterTag ? ` tagged “${filterTag}”` : " yet"}.
            </li>
          ) : null}
        </ul>
      ) : null}

      {tab === "calendar" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="card rounded-xl p-4">
            <MonthCalendar
              lessons={filteredLessons}
              selectedDay={selectedDay}
              onSelectDay={(day) => {
                setSelectedDay(day);
                goTab("calendar", { day });
              }}
            />
            <p className="mt-3 text-xs text-muted">
              Days with lessons are highlighted. Tap a day to open that writeup.
            </p>
          </div>
          <div className="space-y-3">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
              {selectedDay ? formatDay(selectedDay) : "Pick a day"}
            </h3>
            {selectedDay && dayLessons.length ? (
              <ul className="space-y-4">
                {dayLessons.map((lesson) => (
                  <li key={lesson.id} className="space-y-2">
                    <LessonCard lesson={lesson} classId={classId} tagLinks big />
                    <button
                      type="button"
                      className="text-sm font-bold text-desk-accent underline-offset-2 hover:underline"
                      onClick={() => goTab("lessons", { lessonId: lesson.id })}
                    >
                      Open in Lessons tab →
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                {selectedDay
                  ? "No lesson on this day."
                  : "Use the calendar to find a lesson by date."}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {tab === "files" ? (
        <section className="card rounded-xl p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
                Class files
              </h3>
              <p className="mt-1 text-sm text-muted">
                Organised previews — download anytime from here or My Desk.
              </p>
            </div>
            <Link
              href="/portal/resources"
              className="text-sm font-bold text-desk-accent underline-offset-2 hover:underline"
            >
              All my files →
            </Link>
          </div>
          <ClassFilesList
            files={files}
            knownTags={knownTags}
            showTypeOrganiser
          />
        </section>
      ) : null}

      {tab === "tests" ? (
        <section className="card space-y-5 rounded-xl p-5">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
              Quizzes &amp; exams
            </h3>
            <p className="mt-1 text-sm text-muted">
              Teachers can set tests in two ways — nothing is listed here yet.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="rounded-lg border border-border bg-[#f3f2ee] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
                Download
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                Teacher-uploaded papers
              </p>
              <p className="mt-1 text-sm text-muted">
                PDF or worksheet uploads you download, complete, and return as the
                teacher asks.
              </p>
            </li>
            <li className="rounded-lg border border-border bg-[#f3f2ee] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
                In portal
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">Links to online tests</p>
              <p className="mt-1 text-sm text-muted">
                Links your teacher adds so you can open a full quiz or exam inside
                the portal.
              </p>
            </li>
          </ul>

          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            No quizzes or exams yet. When your teacher adds one, it will show up
            here.
          </p>
        </section>
      ) : null}
    </div>
  );
}
