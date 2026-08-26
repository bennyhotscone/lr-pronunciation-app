import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { llmConfigured } from "@/lib/llm";
import { requireStaff } from "@/lib/portal-access";
import {
  getTeacherStudentsForCapture,
  teacherStartLessonCapture,
} from "@/lib/lesson-capture-actions";

function studentLabel(user: {
  email: string;
  profile: { preferredName: string | null; fullName: string | null } | null;
}) {
  return user.profile?.preferredName || user.profile?.fullName || user.email;
}

function formatWhen(d: Date) {
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function durationLabel(start: Date, end: Date | null) {
  if (!end) return "In progress";
  const mins = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
  return `${mins} min`;
}

function summaryPreview(text: string | null | undefined, max = 140) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

async function startSessionAction(formData: FormData): Promise<void> {
  "use server";
  await teacherStartLessonCapture(formData);
}

export default async function LessonCapturePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const session = await requireStaff();
  const sp = await searchParams;
  const llmReady = llmConfigured();

  const active = await prisma.lessonCaptureSession.findFirst({
    where: { teacherId: session.user.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (active) {
    redirect(`/teacher/lesson-capture/${active.id}`);
  }

  const [students, pastSessions] = await Promise.all([
    getTeacherStudentsForCapture(session.user.id, session.user.role),
    prisma.lessonCaptureSession.findMany({
      where: {
        teacherId: session.user.id,
        status: { in: ["ENDED", "PROCESSING", "FAILED"] },
      },
      include: {
        student: { include: { profile: true } },
        _count: { select: { attachments: true, liveNotes: true, frames: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
  ]);

  const filterStudentId = sp.student || "";
  const filtered = filterStudentId
    ? pastSessions.filter((s) => s.studentId === filterStudentId)
    : pastSessions;

  return (
    <div className="blackboard-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-chalk/50">
            Teacher · lesson memory
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold text-chalk">
            Track what you covered
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-chalk/70">
            Auto-screenshot every 60s → OCR on-screen text → Groq builds lasting lesson memory
            from OCR + your typed notes. Start screen capture during each live session. Frames
            are deleted after a successful AI run.
          </p>
        </div>
        <Link
          href="/teacher"
          className="text-sm font-bold text-chalk-accent underline-offset-2 hover:underline"
        >
          ← Classrooms
        </Link>
      </div>

      {!llmReady ? (
        <section
          className="mt-6 rounded-2xl border-2 border-amber-400/50 bg-amber-500/15 p-5"
          role="alert"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-amber-200">
            Free AI not configured
          </p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-chalk">
            Add a free Groq API key so End Session can turn your typed notes into a lasting
            summary, auto-notes, and topics. ChatGPT Plus is not an API key.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-chalk/85">
            <li>
              Get a key at{" "}
              <a
                href="https://console.groq.com"
                className="font-semibold text-amber-100 underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                console.groq.com
              </a>
            </li>
            <li>
              Add this line to <code className="text-amber-100">.env.local</code>, then restart
              the server:
            </li>
          </ol>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-amber-100">
            GROQ_API_KEY=gsk_your_key_here
          </pre>
          <p className="mt-2 text-sm text-chalk/75">
            Optional upgrades: <code className="text-chalk/90">OPENAI_API_KEY</code> for
            screenshot vision, or <code className="text-chalk/90">ANTHROPIC_API_KEY</code> as
            another text LLM.
          </p>
        </section>
      ) : null}

      <section className="board-panel mt-8 rounded-2xl p-6">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-chalk">
          Start a lesson session
        </h2>
        <p className="mt-2 text-sm text-chalk/60">
          Share the lesson screen if you want, and type quick notes as you teach. When you end,
          free AI writes the lasting record for this student from those notes.
        </p>
        {!students.length ? (
          <p className="mt-3 text-sm text-chalk/65">
            No students yet — share a classroom invite code so students can join.
          </p>
        ) : (
          <form action={startSessionAction} className="mt-4 flex flex-wrap gap-3">
            <select
              name="studentId"
              required
              defaultValue={filterStudentId}
              className="min-w-[220px] flex-1 rounded-xl border border-chalk/25 bg-black/25 px-4 py-3 text-chalk"
            >
              <option value="">Choose student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="btn-chalk rounded-xl px-6 py-3 text-sm font-bold"
            >
              Start session
            </button>
          </form>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-chalk">
              Class memory over time
            </h2>
            <p className="mt-1 text-sm text-chalk/55">
              Per-student history of AI summaries and topics covered.
            </p>
          </div>
          {filterStudentId ? (
            <Link
              href="/teacher/lesson-capture"
              className="text-sm font-semibold text-chalk-accent underline-offset-2 hover:underline"
            >
              Show all students
            </Link>
          ) : null}
        </div>

        {!filtered.length ? (
          <p className="mt-3 text-sm text-chalk/55">
            {filterStudentId
              ? "No saved lesson memory for this student yet."
              : "No saved sessions yet — start one above."}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {filtered.map((s) => {
              const preview = summaryPreview(s.summary);
              const hasAiNotes = Boolean(s.autoNotes?.trim());
              const aiBlocked = Boolean(s.processingError);
              return (
                <li key={s.id}>
                  <Link
                    href={`/teacher/lesson-capture/${s.id}`}
                    className="board-panel flex flex-wrap items-center justify-between gap-2 rounded-xl p-4 transition hover:brightness-110"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-chalk">
                        {studentLabel(s.student)}
                        {s.status === "PROCESSING" ? (
                          <span className="ml-2 text-xs font-bold uppercase text-amber-200/90">
                            Analyzing
                          </span>
                        ) : null}
                        {s.status === "FAILED" ? (
                          <span className="ml-2 text-xs font-bold uppercase text-red-300/90">
                            Failed
                          </span>
                        ) : null}
                        {aiBlocked && s.status === "ENDED" ? (
                          <span className="ml-2 text-xs font-bold uppercase text-amber-200/90">
                            AI incomplete
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-chalk/55">
                        {formatWhen(s.startedAt)} ·{" "}
                        {durationLabel(s.startedAt, s.endedAt)} ·{" "}
                        {s._count.liveNotes} notes · {s._count.attachments} files
                        {s.framesCaptured > 0
                          ? ` · ${s.framesCaptured} frames analyzed`
                          : s._count.frames > 0
                            ? ` · ${s._count.frames} frames pending AI`
                            : ""}
                        {hasAiNotes ? " · AI notes" : ""}
                      </p>
                      {preview ? (
                        <p className="mt-1.5 text-sm leading-snug text-chalk/80">{preview}</p>
                      ) : (
                        <p className="mt-1.5 text-sm text-chalk/45">No AI summary yet</p>
                      )}
                      {s.topicsCovered.length ? (
                        <p className="mt-1 text-xs text-chalk/65">
                          {s.topicsCovered.join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-chalk-accent" aria-hidden>
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
