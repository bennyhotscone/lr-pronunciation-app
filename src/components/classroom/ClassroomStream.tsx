"use client";

import { useMemo, useState, useTransition } from "react";
import {
  commentOnClassPost,
  teacherCreateClassPost,
  teacherTogglePinPost,
} from "@/lib/classroom-actions";
import { TagPicker } from "@/components/classroom/TagPicker";
import { TagFilterBar } from "@/components/classroom/TagPicker";

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

export function ClassroomStream({
  classId,
  posts,
  canPost,
  knownTags = [],
}: {
  classId: string;
  posts: StreamPost[];
  canPost: boolean;
  knownTags?: string[];
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const allTags = useMemo(() => {
    const s = new Set<string>(knownTags);
    for (const p of posts) for (const t of p.tags || []) s.add(t);
    return [...s].sort();
  }, [posts, knownTags]);

  const visible = filterTag
    ? posts.filter((p) => (p.tags || []).includes(filterTag))
    : posts;

  return (
    <section className="space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Stream</h2>
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
          <button type="submit" disabled={pending} className="btn-primary rounded px-4 py-2 text-sm font-bold disabled:opacity-50">
            Post
          </button>
          {msg ? <p className="text-sm text-success">{msg}</p> : null}
        </form>
      ) : null}

      <ul className="space-y-3">
        {visible.map((p) => (
          <li key={p.id} className="card rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                {p.pinnedAt ? (
                  <span className="mb-1 inline-block rounded bg-accent/20 px-2 py-0.5 text-xs font-bold">
                    Pinned
                  </span>
                ) : null}
                <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                  {p.title}
                </h3>
                <p className="text-xs text-muted">
                  {p.authorLabel} · {new Date(p.createdAt).toLocaleString()}
                </p>
                {p.tags?.length ? (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded px-1.5 py-0.5 text-[0.7rem] font-semibold text-foreground ring-1 ring-border"
                      >
                        {t}
                      </span>
                    ))}
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
                  <input type="hidden" name="postId" value={p.id} />
                  <button type="submit" className="text-xs font-bold text-accent">
                    {p.pinnedAt ? "Unpin" : "Pin"}
                  </button>
                </form>
              ) : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p>
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-bold uppercase text-muted">Comments</p>
              <ul className="mt-2 space-y-2">
                {p.comments.map((c) => (
                  <li key={c.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <span className="text-xs font-semibold text-muted">{c.authorLabel}</span>
                    <p className="text-foreground">{c.body}</p>
                  </li>
                ))}
                {!p.comments.length ? <li className="text-sm text-muted">No comments yet.</li> : null}
              </ul>
              <form
                className="mt-2 flex gap-2"
                action={(fd) => {
                  startTransition(async () => {
                    await commentOnClassPost(fd);
                  });
                }}
              >
                <input type="hidden" name="postId" value={p.id} />
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
        ))}
        {!visible.length ? <li className="text-sm text-muted">No posts{filterTag ? ` tagged “${filterTag}”` : ""}.</li> : null}
      </ul>
    </section>
  );
}
