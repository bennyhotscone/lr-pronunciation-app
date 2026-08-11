"use client";

import { useState, useTransition } from "react";
import {
  staffCommentOnPost,
  studentCommentOnPost,
  teacherCreateClassPost,
  teacherTogglePinPost,
} from "@/lib/portal-actions";
import { BasketAttachFields } from "@/components/portal/SessionBasket";

export type PostView = {
  id: string;
  title: string;
  body: string;
  pinnedAt: string | null;
  createdAt: string;
  authorLabel: string;
  attachments: { id: string; filename: string; blobUrl: string }[];
  comments: {
    id: string;
    body: string;
    createdAt: string;
    authorLabel: string;
    parentId: string | null;
  }[];
};

export function TeacherClassPosts({
  classId,
  posts,
}: {
  classId: string;
  posts: PostView[];
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    action: (fd: FormData) => Promise<{ error?: string; ok?: boolean }>,
    fd: FormData,
    okMsg: string,
  ) {
    setMsg(null);
    startTransition(async () => {
      const res = await action(fd);
      if (res?.error) setMsg(res.error);
      else setMsg(okMsg);
    });
  }

  return (
    <div className="mt-8 space-y-6">
      {msg ? (
        <p className="rounded-xl bg-sand-accent/15 px-3 py-2 text-sm font-semibold" role="status">
          {msg}
        </p>
      ) : null}

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Classroom post
        </h2>
        <p className="mt-1 text-sm text-muted">
          Share a note for the class. Pin important posts so they stay on top.
        </p>
        <form
          className="mt-3 grid gap-3"
          action={(fd) => run(teacherCreateClassPost, fd, "Post published.")}
        >
          <input type="hidden" name="classId" value={classId} />
          <BasketAttachFields />
          <input
            name="title"
            required
            placeholder="Title"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <textarea
            name="body"
            required
            rows={4}
            placeholder="Body"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="pin" value="1" />
            Pin this post
          </label>
          <button
            type="submit"
            disabled={pending}
            className="btn-primary rounded-xl px-4 py-2 text-sm font-bold"
          >
            Publish post
          </button>
        </form>
      </section>

      <ClassPostList posts={posts} mode="staff" />
    </div>
  );
}

export function ClassPostList({
  posts,
  mode,
}: {
  posts: PostView[];
  mode: "staff" | "student";
}) {
  const [pending, startTransition] = useTransition();
  const commentAction = mode === "staff" ? staffCommentOnPost : studentCommentOnPost;

  if (!posts.length) {
    return <p className="text-sm text-muted">No classroom posts yet.</p>;
  }

  return (
    <ul className="space-y-4">
      {posts.map((post) => (
        <li key={post.id} className="card rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {post.pinnedAt ? (
                  <span className="chip bg-sand-accent/20 text-sand-accent">Pinned</span>
                ) : null}
                <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                  {post.title}
                </h3>
              </div>
              <p className="mt-1 text-xs text-muted">
                {post.authorLabel} · {new Date(post.createdAt).toLocaleString()}
              </p>
            </div>
            {mode === "staff" ? (
              <form
                action={(fd) => {
                  startTransition(async () => {
                    await teacherTogglePinPost(fd);
                  });
                }}
              >
                <input type="hidden" name="postId" value={post.id} />
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-bold"
                >
                  {post.pinnedAt ? "Unpin" : "Pin"}
                </button>
              </form>
            ) : null}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{post.body}</p>
          {post.attachments.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {post.attachments.map((a) => (
                <li key={a.id}>
                  <span className="font-semibold">{a.filename}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 border-t border-border/70 pt-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted">Comments</h4>
            {post.comments.length ? (
              <ul className="mt-2 space-y-2">
                {post.comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-background/50 px-3 py-2 text-sm">
                    <p className="text-xs text-muted">
                      {c.authorLabel}
                      {c.parentId ? " · reply" : ""} ·{" "}
                      {new Date(c.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-0.5">{c.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No comments yet.</p>
            )}
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              action={(fd) => {
                startTransition(async () => {
                  await commentAction(fd);
                });
              }}
            >
              <input type="hidden" name="postId" value={post.id} />
              <input
                name="body"
                required
                placeholder={mode === "student" ? "Write a comment or reply…" : "Reply as teacher…"}
                className="min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={pending}
                className="btn-secondary rounded-xl px-4 py-2 text-sm font-bold"
              >
                Comment
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
