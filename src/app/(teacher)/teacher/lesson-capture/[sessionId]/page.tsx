import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { llmConfigured } from "@/lib/llm";
import { isAdmin, requireStaff } from "@/lib/portal-access";
import { SessionBasketProvider } from "@/components/portal/SessionBasket";
import {
  LessonCaptureActiveSession,
  LessonCaptureProcessingView,
} from "@/components/lesson-capture/LessonCaptureActiveSession";
import { LessonCaptureSessionEdit } from "@/components/lesson-capture/LessonCaptureSessionEdit";
import { FilePreviewThumb } from "@/components/classroom/FilePreviewThumb";
import { teacherRerunLessonCaptureAi } from "@/lib/lesson-capture-actions";

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

type TimelineEntry = { minuteOffset: number; topic: string };

function parseTimeline(raw: unknown): TimelineEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => {
      if (!t || typeof t !== "object") return null;
      const o = t as { minuteOffset?: unknown; topic?: unknown };
      const topic = String(o.topic || "").trim();
      if (!topic) return null;
      return {
        minuteOffset: Number(o.minuteOffset) || 0,
        topic,
      };
    })
    .filter((t): t is TimelineEntry => Boolean(t));
}

async function rerunAiAction(formData: FormData): Promise<void> {
  "use server";
  await teacherRerunLessonCaptureAi(formData);
}

export default async function LessonCaptureSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const staffSession = await requireStaff();
  const { sessionId } = await params;
  const llmReady = llmConfigured();

  const capture = await prisma.lessonCaptureSession.findUnique({
    where: { id: sessionId },
    include: {
      student: { include: { profile: true } },
      liveNotes: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      _count: { select: { frames: true } },
    },
  });

  if (!capture) notFound();
  if (
    !isAdmin(staffSession.user.role) &&
    capture.teacherId !== staffSession.user.id
  ) {
    notFound();
  }

  const label = studentLabel(capture.student);

  if (capture.status === "ACTIVE") {
    return (
      <SessionBasketProvider userId={staffSession.user.id}>
        <div className="blackboard-shell">
          <Link
            href="/teacher/lesson-capture"
            className="text-sm font-semibold text-chalk/55 hover:text-chalk-accent"
          >
            Back to lesson memory
          </Link>
          {!llmReady ? (
            <section
              className="mt-4 rounded-xl border-2 border-amber-400/50 bg-amber-500/15 p-4"
              role="alert"
            >
              <p className="text-xs font-bold uppercase text-amber-200">
                Free AI not configured
              </p>
              <p className="mt-1 text-sm text-chalk/90">
                Add <code className="text-amber-100">GROQ_API_KEY=gsk_…</code> to{" "}
                <code className="text-amber-100">.env.local</code> (free at console.groq.com),
                restart, then End Session. Typed notes are the primary signal for lesson memory.
              </p>
            </section>
          ) : null}
          <div className="mt-4">
            <LessonCaptureActiveSession
              sessionId={capture.id}
              studentLabel={label}
              startedAt={capture.startedAt.toISOString()}
              llmReady={llmReady}
              initialNotes={capture.liveNotes.map((n) => ({
                id: n.id,
                body: n.body,
                createdAt: n.createdAt.toISOString(),
              }))}
            />
          </div>
        </div>
      </SessionBasketProvider>
    );
  }

  if (capture.status === "PROCESSING") {
    return (
      <div className="blackboard-shell">
        <Link
          href="/teacher/lesson-capture"
          className="text-sm font-semibold text-chalk/55 hover:text-chalk-accent"
        >
          Back to lesson memory
        </Link>
        <LessonCaptureProcessingView sessionId={capture.id} studentLabel={label} />
      </div>
    );
  }

  const timeline = parseTimeline(capture.timeline);
  const framesPending = capture._count.frames > 0;
  const canRerun = framesPending && (capture.status === "ENDED" || capture.status === "FAILED");

  return (
    <div className="blackboard-shell">
      <Link
        href={`/teacher/lesson-capture${capture.studentId ? `?student=${capture.studentId}` : ""}`}
        className="text-sm font-semibold text-chalk/55 hover:text-chalk-accent"
      >
        Back to class memory
      </Link>

      <header className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-chalk/50">
          {capture.status === "FAILED" ? "Session failed" : "Lesson memory"}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-chalk">
          {label}
        </h1>
        <p className="mt-1 text-sm text-chalk/65">
          {formatWhen(capture.startedAt)}
          {capture.endedAt ? ` - ${formatWhen(capture.endedAt)}` : ""} |{" "}
          {durationLabel(capture.startedAt, capture.endedAt)}
          {capture.framesCaptured > 0 ? ` | ${capture.framesCaptured} frames` : ""}
        </p>
      </header>

      {capture.processingError ? (
        <section className="board-panel mt-6 rounded-xl border border-amber-400/35 p-4">
          <h2 className="text-xs font-bold uppercase text-amber-200">AI analysis issue</h2>
          <p className="mt-2 text-sm text-chalk/85">{capture.processingError}</p>
          {canRerun ? (
            <form action={rerunAiAction} className="mt-3">
              <input type="hidden" name="sessionId" value={capture.id} />
              <button
                type="submit"
                className="btn-chalk rounded-lg px-4 py-2 text-sm font-bold"
                disabled={!llmReady}
              >
                {llmReady
                  ? `Re-run AI analysis (${capture._count.frames} frames kept)`
                  : "Re-run blocked — set GROQ_API_KEY first"}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {capture.status === "FAILED" && !capture.processingError ? (
        <section className="board-panel mt-6 rounded-xl border border-red-400/30 p-4">
          <h2 className="text-xs font-bold uppercase text-red-300">Processing error</h2>
          <p className="mt-2 text-sm text-chalk/85">Unknown failure while building lesson memory.</p>
        </section>
      ) : null}

      {capture.summary ? (
        <section className="board-panel mt-6 rounded-xl p-4">
          <h2 className="text-xs font-bold uppercase text-chalk/50">What we covered</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-chalk/90">
            {capture.summary}
          </p>
        </section>
      ) : null}

      {capture.autoNotes ? (
        <section className="board-panel mt-4 rounded-xl p-4">
          <h2 className="text-xs font-bold uppercase text-chalk/50">AI lesson notes</h2>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-chalk/85">
            {capture.autoNotes}
          </pre>
        </section>
      ) : null}

      {timeline.length ? (
        <section className="board-panel mt-4 rounded-xl p-4">
          <h2 className="text-xs font-bold uppercase text-chalk/50">Lesson timeline</h2>
          <ol className="mt-3 space-y-2">
            {timeline.map((t, i) => (
              <li key={i} className="flex gap-3 text-sm text-chalk/85">
                <span className="shrink-0 font-mono text-xs text-chalk/45">
                  {t.minuteOffset}m
                </span>
                <span>{t.topic}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {capture.topicsCovered.length ? (
        <section className="board-panel mt-4 rounded-xl p-4">
          <h2 className="text-xs font-bold uppercase text-chalk/50">Topics covered</h2>
          <p className="mt-2 text-sm text-chalk">{capture.topicsCovered.join(", ")}</p>
        </section>
      ) : null}

      {capture.transcript ? (
        <section className="board-panel mt-4 rounded-xl p-4">
          <h2 className="text-xs font-bold uppercase text-chalk/50">Visual transcript</h2>
          <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-chalk/80">
            {capture.transcript}
          </pre>
        </section>
      ) : null}

      {capture.notes ? (
        <section className="board-panel mt-4 rounded-xl p-4">
          <h2 className="text-xs font-bold uppercase text-chalk/50">Teacher notes</h2>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-chalk/85">
            {capture.notes}
          </pre>
        </section>
      ) : null}

      {capture.attachments.length ? (
        <section className="board-panel mt-4 rounded-xl p-4">
          <h2 className="text-xs font-bold uppercase text-chalk/50">Worksheets</h2>
          <ul className="mt-3 divide-y divide-chalk/10">
            {capture.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <FilePreviewThumb
                  src={a.blobUrl}
                  filename={a.filename}
                  mimeType={a.mimeType}
                  className="h-16 w-12"
                />
                <a
                  href={`/api/teacher/lesson-capture/attachments/${a.id}/download`}
                  className="min-w-0 flex-1 break-all text-sm font-semibold text-chalk-accent underline-offset-2 hover:underline"
                >
                  {a.filename}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canRerun && !capture.processingError ? (
        <section className="board-panel mt-4 rounded-xl p-4">
          <p className="text-sm text-chalk/70">
            {capture._count.frames} screenshot(s) still on file — re-run AI to build lesson
            memory from notes + frames.
          </p>
          <form action={rerunAiAction} className="mt-3">
            <input type="hidden" name="sessionId" value={capture.id} />
            <button
              type="submit"
              className="btn-chalk rounded-lg px-4 py-2 text-sm font-bold"
              disabled={!llmReady}
            >
              {llmReady ? "Re-run AI analysis" : "Set GROQ_API_KEY to re-run"}
            </button>
          </form>
        </section>
      ) : null}

      {capture.status !== "FAILED" ? (
        <LessonCaptureSessionEdit
          sessionId={capture.id}
          initialSummary={capture.summary || ""}
          initialAutoNotes={capture.autoNotes || ""}
          initialNotes={capture.notes || ""}
          initialTopics={capture.topicsCovered.join(", ")}
        />
      ) : null}

      {!capture.summary &&
      !capture.autoNotes &&
      !capture.notes &&
      !capture.attachments.length &&
      !capture.topicsCovered.length &&
      !capture.transcript ? (
        <p className="mt-6 text-sm text-chalk/55">Empty session — no lesson memory saved.</p>
      ) : null}
    </div>
  );
}
