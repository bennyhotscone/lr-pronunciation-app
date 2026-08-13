"use client";

import { useState, useTransition } from "react";
import {
  enrollStudentInClass,
  removeStudentFromClass,
  teacherAddHomework,
  teacherAddLesson,
  teacherAddRecommendation,
  teacherUploadResource,
} from "@/lib/portal-actions";
import {
  BasketAttachFields,
  SessionBasketPanel,
} from "@/components/portal/SessionBasket";
import { MaterialKindPicker } from "@/components/classroom/MaterialKindPicker";
import { PdfPagePicker } from "@/components/classroom/PdfPagePicker";
import { isPdfFile } from "@/lib/pdf-file";

type StudentOption = { id: string; label: string };
type LessonOption = { id: string; title: string };

export function ClassTools({
  classId,
  students,
  enrolledIds,
  lessons,
}: {
  classId: string;
  students: StudentOption[];
  enrolledIds: string[];
  lessons: LessonOption[];
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageSelectionOk, setPageSelectionOk] = useState(true);
  const enrolled = new Set(enrolledIds);
  const notEnrolled = students.filter((s) => !enrolled.has(s.id));

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

      <SessionBasketPanel />

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Enroll student</h2>
        <p className="mt-1 text-sm text-muted">
          Students do not get an invite code. They must have an account first (they use{" "}
          <a href="/signup" className="font-semibold text-sand-accent underline-offset-2 hover:underline">
            /signup
          </a>{" "}
          or you use <strong>Add Student</strong> on the dashboard), then you enroll them here.
          While enrolled they see this class&apos;s lessons, files, and posts on My Desk.
        </p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          action={(fd) => run(enrollStudentInClass, fd, "Student enrolled.")}
        >
          <input type="hidden" name="classId" value={classId} />
          <select
            name="studentId"
            required
            className="min-w-[200px] flex-1 rounded-xl border border-border bg-background/60 px-3 py-2"
          >
            <option value="">Select student…</option>
            {notEnrolled.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || notEnrolled.length === 0}
            className="btn-primary rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            Enroll
          </button>
        </form>
        {students.filter((s) => enrolled.has(s.id)).length > 0 ? (
          <ul className="mt-4 divide-y divide-border/70">
            {students
              .filter((s) => enrolled.has(s.id))
              .map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{s.label}</span>
                  <form action={(fd) => run(removeStudentFromClass, fd, "Student removed from class.")}>
                    <input type="hidden" name="classId" value={classId} />
                    <input type="hidden" name="studentId" value={s.id} />
                    <button type="submit" className="font-semibold text-danger">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
          </ul>
        ) : null}
      </section>

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Add lesson</h2>
        <form
          className="mt-3 grid gap-3"
          action={(fd) => run(teacherAddLesson, fd, "Lesson added for the class.")}
        >
          <input type="hidden" name="classId" value={classId} />
          <BasketAttachFields />
          <input
            name="title"
            required
            placeholder="Title"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <input
            name="date"
            type="date"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <textarea
            name="summary"
            rows={3}
            placeholder="Summary"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <textarea
            name="teacherNotes"
            rows={2}
            placeholder="Teacher notes (optional)"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <input
            name="tags"
            placeholder="Tags (comma-separated)"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <button type="submit" disabled={pending} className="btn-primary rounded-xl px-4 py-2 text-sm font-bold">
            Save lesson
          </button>
        </form>
      </section>

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Upload file (class)</h2>
        <form
          className="mt-3 grid gap-3"
          action={(fd) => {
            if (pdfFile && !pageSelectionOk) {
              setMsg("Select at least one PDF page to upload.");
              return;
            }
            run(teacherUploadResource, fd, "File uploaded — students will see it on My Desk.");
            setPdfFile(null);
            setPageSelectionOk(true);
          }}
        >
          <input type="hidden" name="classId" value={classId} />
          <input
            name="title"
            placeholder="Title (optional)"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <select name="lessonId" className="rounded-xl border border-border bg-background/60 px-3 py-2">
            <option value="">No lesson link</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
          <MaterialKindPicker defaultValue="INFO" idPrefix="class-tools-upload" />
          <input
            name="file"
            type="file"
            required
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && isPdfFile(f)) {
                setPdfFile(f);
                setPageSelectionOk(true);
              } else {
                setPdfFile(null);
                setPageSelectionOk(true);
              }
            }}
          />
          <PdfPagePicker
            file={pdfFile}
            onChange={(sel) => {
              if (!sel) {
                setPageSelectionOk(true);
                return;
              }
              setPageSelectionOk(sel.pages.length > 0);
            }}
          />
          <button
            type="submit"
            disabled={pending || (Boolean(pdfFile) && !pageSelectionOk)}
            className="btn-primary rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            Upload to class
          </button>
        </form>
      </section>

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">Add homework</h2>
        <form
          className="mt-3 grid gap-3"
          action={(fd) => run(teacherAddHomework, fd, "Homework assigned to class.")}
        >
          <input type="hidden" name="classId" value={classId} />
          <input
            name="title"
            required
            placeholder="Title"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <textarea
            name="instructions"
            required
            rows={3}
            placeholder="Instructions"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <input
            name="dueAt"
            type="date"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <select name="lessonId" className="rounded-xl border border-border bg-background/60 px-3 py-2">
            <option value="">No lesson link</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="btn-primary rounded-xl px-4 py-2 text-sm font-bold">
            Assign homework
          </button>
        </form>
      </section>

      <section className="card rounded-2xl p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Recommended practice
        </h2>
        <form
          className="mt-3 grid gap-3"
          action={(fd) => run(teacherAddRecommendation, fd, "Recommendation published.")}
        >
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="approval" value="APPROVED" />
          <input
            name="title"
            required
            placeholder="Title"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <input
            name="url"
            placeholder="https://…"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <textarea
            name="description"
            rows={2}
            placeholder="Why this helps"
            className="rounded-xl border border-border bg-background/60 px-3 py-2"
          />
          <button type="submit" disabled={pending} className="btn-secondary rounded-xl px-4 py-2 text-sm font-bold">
            Add recommendation
          </button>
        </form>
      </section>
    </div>
  );
}
