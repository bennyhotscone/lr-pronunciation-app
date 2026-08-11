"use client";

import { useMemo, useState, useTransition } from "react";
import {
  commentOnClassPost,
  teacherCreateClassPost,
  teacherTogglePinPost,
} from "@/lib/classroom-actions";
import { TagPicker } from "@/components/classroom/TagPicker";
import { TagFilterBar } from "@/components/classroom/TagPicker";
import { InfoTag } from "@/components/classroom/InfoTag";

function resourceHref(resourceId: string) {
  return `/api/portal/resources/${resourceId}/download`;
}

export type StreamPost = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinnedAt: string | null;
  createdAt: string;
  authorLabel: string;
  comments: { id: string; body: string; createdAt: string; authorLabel: string }[];
};

export type StreamLesson = {
  id: string;
  day: string;
  title: string | null;
  summary: string;
  tags: string[];
  createdAt: string;
  subEntries: { id: string; kind: string; title: string; body: string | null }[];
  attachments: {
    id: string;
    filename: string;
    mimeType: string;
    resourceId: string | null;
  }[];
};

type TimelineItem =
  | { kind: "post"; sortAt: number; pinned: boolean; post: StreamPost }
  | { kind: "lesson"; sortAt: number; pinned: boolean; lesson: StreamLesson };

function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

function AttachmentChip({
  filename,
  mimeType,
  resourceId,
}: {
  filename: string;
  mimeType: string;
  resourceId: string | null;
}) {
  const href = resourceId ? resourceHref(resourceId) : null;
  const inner = (
    <>
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-[#ebe8e0] ring-1 ring-border">
        {href && isImageMime(mimeType) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-[0.65rem] font-bold text-desk-accent">
            {mimeType === "application/pdf" || /\.pdf$/i.test(filename) ? "PDF" : "FILE"}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink group-hover:text-desk-accent">
        {filename}
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

export function ClassroomStream({
  classId,
  posts,
  lessons = [],
  canPost,
  knownTags = [],
  tagLinks = false,
}: {
  classId: string;
  posts: StreamPost[];
  lessons?: StreamLesson[];
  canPost: boolean;
  knownTags?: string[];
  /** Student classroom: tags link into find + study links. */
  tagLinks?: boolean;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<"all" | "posts" | "lessons">("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const allTags = useMemo(() => {
    const s = new Set<string>(knownTags);
    for (const p of posts) for (const t of p.tags || []) s.add(t);
    for (const l of lessons) for (const t of l.tags || []) s.add(t);
    return [...s].sort();
  }, [posts, lessons, knownTags]);

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [
      ...posts.map((post) => ({
        kind: "post" as const,
        sortAt: new Date(post.createdAt).getTime(),
        pinned: Boolean(post.pinnedAt),
        post,
      })),
      ...lessons.map((lesson) => ({
        kind: "lesson" as const,
        sortAt: new Date(lesson.createdAt || lesson.day).getTime(),
        pinned: false,
        lesson,
      })),
    ];

    return items
      .filter((item) => {
        if (filterKind === "posts" && item.kind !== "post") return false;
        if (filterKind === "lessons" && item.kind !== "lesson") return false;
        if (!filterTag) return true;
        const tags = item.kind === "post" ? item.post.tags : item.lesson.tags;
        return (tags || []).includes(filterTag);
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.sortAt - a.sortAt;
      });
  }, [posts, lessons, filterTag, filterKind]);

  const showKindFilters = lessons.length > 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
          Stream
        </h2>
        {showKindFilters ? (
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All"],
                ["posts", "Posts"],
                ["lessons", "Lessons"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilterKind(id)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold ring-1 transition ${
                  filterKind === id
                    ? "bg-desk-accent text-white ring-desk-accent"
                    : "bg-[#f3f2ee] text-ink ring-border hover:ring-desk-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <TagFilterBar tags={allTags} active={filterTag} onChange={setFilterTag} />

      {canPost && classId ? (
        <form
          className="card space-y-3 rounded-xl p-4"
          action={(fd) => {
            setMsg(null);
            startTransition(async () => {
              const res = await teacherCreateClassPost(fd);
              if (res?.error) setMsg(res.error);
              else {
                setMsg("Posted.");
                setTitle("");
                setBody("");
              }
            });
          }}
        >
          <input type="hidden" name="classId" value={classId} />
          <input
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            className="w-full rounded border border-border bg-background px-3 py-2"
          />
          <textarea
            name="body"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Share with the class…"
            className="w-full rounded border border-border bg-background px-3 py-2"
          />
          <TagPicker classId={classId} knownTags={knownTags} title={title} body={body} />
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="pin" value="1" /> Pin this post
          </label>
          <button
            type="submit"
            disabled={pending}
            className="btn-primary rounded px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            Post
          </button>
          {msg ? <p className="text-sm text-success">{msg}</p> : null}
        </form>
      ) : null}

      <ul className="space-y-3">
        {timeline.map((item) =>
          item.kind === "post" ? (
            <li key={`post-${item.post.id}`} className="card rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    {item.post.pinnedAt ? (
                      <span className="inline-block rounded bg-accent/20 px-2 py-0.5 text-xs font-bold">
                        Pinned
                      </span>
                    ) : null}
                    <span className="inline-block rounded bg-[#f3f2ee] px-2 py-0.5 text-xs font-bold text-muted ring-1 ring-border">
                      Post
                    </span>
                  </div>
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
                    {item.post.title}
                  </h3>
                  <p className="text-xs text-muted">
                    {item.post.authorLabel} · {new Date(item.post.createdAt).toLocaleString()}
                  </p>
                  {item.post.tags?.length ? (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {item.post.tags.map((t) =>
                        tagLinks && classId ? (
                          <InfoTag key={t} tag={t} classId={classId} />
                        ) : (
                          <span
                            key={t}
                            className="rounded px-1.5 py-0.5 text-[0.7rem] font-semibold text-foreground ring-1 ring-border"
                          >
                            {t}
                          </span>
                        ),
                      )}
                    </p>
                  ) : null}
                </div>
                {canPost ? (
                  <form
                    action={(fd) => {
                      startTransition(async () => {
                        await teacherTogglePinPost(fd);
                      });
                    }}
                  >
                    <input type="hidden" name="postId" value={item.post.id} />
                    <button type="submit" className="text-xs font-bold text-accent">
                      {item.post.pinnedAt ? "Unpin" : "Pin"}
                    </button>
                  </form>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{item.post.body}</p>
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs font-bold uppercase text-muted">Comments</p>
                <ul className="mt-2 space-y-2">
                  {item.post.comments.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <span className="text-xs font-semibold text-muted">{c.authorLabel}</span>
                      <p className="text-foreground">{c.body}</p>
                    </li>
                  ))}
                  {!item.post.comments.length ? (
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
                  <input type="hidden" name="postId" value={item.post.id} />
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
            </li>
          ) : (
            <li key={`lesson-${item.lesson.id}`} className="card rounded-xl p-4">
              <div className="mb-1 flex flex-wrap gap-1.5">
                <span className="inline-block rounded bg-desk-accent/15 px-2 py-0.5 text-xs font-bold text-desk-accent ring-1 ring-desk-accent/30">
                  Lesson
                </span>
              </div>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
                {item.lesson.day.slice(0, 10)}
                {item.lesson.title ? ` · ${item.lesson.title}` : ""}
              </h3>

              <div className="mt-3 rounded-lg border border-border bg-[#f3f2ee] p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-desk-accent">
                  Summary
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink">{item.lesson.summary}</p>
              </div>

              {item.lesson.tags?.length ? (
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {item.lesson.tags.map((t) =>
                    tagLinks && classId ? (
                      <InfoTag key={t} tag={t} classId={classId} />
                    ) : (
                      <span
                        key={t}
                        className="rounded px-1.5 py-0.5 text-[0.7rem] font-semibold text-foreground ring-1 ring-border"
                      >
                        {t}
                      </span>
                    ),
                  )}
                </p>
              ) : null}

              {item.lesson.subEntries.length ? (
                <ul className="mt-3 space-y-1.5 text-sm text-muted">
                  {item.lesson.subEntries.map((s) => (
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

              {item.lesson.attachments.length ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {item.lesson.attachments.map((a) => (
                    <li key={a.id}>
                      <AttachmentChip
                        filename={a.filename}
                        mimeType={a.mimeType}
                        resourceId={a.resourceId}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ),
        )}
        {!timeline.length ? (
          <li className="text-sm text-muted">
            {filterKind === "lessons"
              ? `No lessons${filterTag ? ` tagged “${filterTag}”` : " yet"}.`
              : filterKind === "posts"
                ? `No posts${filterTag ? ` tagged “${filterTag}”` : " yet"}.`
                : `Nothing in the stream${filterTag ? ` tagged “${filterTag}”` : " yet"}.`}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
