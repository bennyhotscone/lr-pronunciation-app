import { prisma } from "@/lib/db";
import { callLlm, extractJsonObject, llmConfigured } from "@/lib/llm";
import {
  deleteCaptureFrameBlob,
  readCaptureFrameBytes,
} from "@/lib/lesson-capture-storage";
import { revalidatePath } from "next/cache";

type TimelineEntry = { minuteOffset: number; topic: string };

type FrameForOcr = {
  frameIndex: number;
  capturedAt: Date;
  bytes: Buffer;
  mimeType: string;
};

function studentLabel(user: {
  email: string;
  profile: { preferredName: string | null; fullName: string | null } | null;
}) {
  return user.profile?.preferredName || user.profile?.fullName || user.email;
}

function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  if (max <= 1) return [items[0]!];
  const out: T[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * (items.length - 1)) / (max - 1));
    out.push(items[idx]!);
  }
  return out;
}

function parseAiPayload(raw: string): {
  summary: string;
  autoNotes: string;
  topicsCovered: string[];
  timeline: TimelineEntry[];
  transcript: string;
} {
  const parsed = extractJsonObject(raw);
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    const timelineRaw = Array.isArray(o.timeline) ? o.timeline : [];
    const timeline: TimelineEntry[] = timelineRaw
      .map((t) => {
        if (!t || typeof t !== "object") return null;
        const row = t as { minuteOffset?: unknown; topic?: unknown };
        const topic = String(row.topic || "").trim();
        if (!topic) return null;
        return { minuteOffset: Number(row.minuteOffset) || 0, topic };
      })
      .filter((t): t is TimelineEntry => Boolean(t));

    const topics = Array.isArray(o.topicsCovered)
      ? o.topicsCovered.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
      : [];

    return {
      summary: String(o.summary || "").trim() || raw.slice(0, 2000),
      autoNotes: String(o.autoNotes || "").trim() || "",
      topicsCovered: topics,
      timeline,
      transcript: String(o.transcript || "").trim() || "",
    };
  }

  return {
    summary: raw.slice(0, 2000),
    autoNotes: "",
    topicsCovered: [],
    timeline: [],
    transcript: "",
  };
}

/**
 * Real OCR via tesseract.js (Node). Samples evenly when many frames; OCRs all when few.
 * Returns a combined block with frame index + capture time for each recognized page.
 */
async function ocrFrameImages(frames: FrameForOcr[]): Promise<string> {
  if (!frames.length) return "";

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const parts: string[] = [];

  try {
    for (const frame of frames) {
      try {
        const result = await worker.recognize(frame.bytes);
        const text = String(result.data?.text || "").trim();
        if (!text) continue;
        const clock = frame.capturedAt.toISOString().slice(11, 16);
        parts.push(`[frame ${frame.frameIndex} @ ${clock}]\n${text}`);
      } catch {
        /* skip unreadable frame; continue OCR of the rest */
      }
    }
  } finally {
    await worker.terminate();
  }

  return parts.join("\n\n");
}

export async function deleteAllSessionFrameBlobs(sessionId: string): Promise<void> {
  const frames = await prisma.lessonCaptureFrame.findMany({
    where: { sessionId },
    select: { blobPath: true, blobUrl: true },
  });
  for (const f of frames) {
    try {
      await deleteCaptureFrameBlob(f);
    } catch {
      /* ignore */
    }
  }
  await prisma.lessonCaptureFrame.deleteMany({ where: { sessionId } });
}

/**
 * Post-session pipeline (required path):
 * 1. Read screenshots → OCR with tesseract.js
 * 2. callLlm (Groq → OpenAI → Anthropic) on teacher notes + OCR text + topics
 * 3. Save structured memory; delete raw frames after successful OCR+analysis
 *
 * OpenAI vision is NOT required for the default path.
 */
export async function processLessonCaptureSession(sessionId: string): Promise<void> {
  const capture = await prisma.lessonCaptureSession.findUnique({
    where: { id: sessionId },
    include: {
      student: { include: { profile: true } },
      frames: { orderBy: { frameIndex: "asc" } },
      liveNotes: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!capture || capture.status !== "PROCESSING") return;

  const label = studentLabel(capture.student);
  const frameCount = capture.frames.length;
  const notesBlock = [
    capture.notes?.trim() || "",
    ...capture.liveNotes.map((n) => {
      const t = n.createdAt.toISOString().slice(11, 16);
      return `[${t}] ${n.body}`;
    }),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    let summary = "";
    let autoNotes = "";
    let topicsCovered = capture.topicsCovered;
    let timeline: TimelineEntry[] = [];
    let transcript = "";
    let processingError: string | null = null;
    let analysisSucceeded = false;
    let ocrSucceeded = frameCount === 0;

    const startedMs = capture.startedAt.getTime();
    const sampledMeta = sampleEvenly(capture.frames, 24);
    const framesForOcr: FrameForOcr[] = [];

    for (const frame of sampledMeta) {
      const read = await readCaptureFrameBytes({
        blobPath: frame.blobPath,
        blobUrl: frame.blobUrl,
      });
      if (!read) continue;
      framesForOcr.push({
        frameIndex: frame.frameIndex,
        capturedAt: frame.capturedAt,
        bytes: read.bytes,
        mimeType: frame.mimeType || "image/webp",
      });
    }

    let ocrText = "";
    if (framesForOcr.length) {
      try {
        ocrText = await ocrFrameImages(framesForOcr);
        ocrSucceeded = true;
      } catch (e) {
        processingError =
          e instanceof Error
            ? `OCR failed: ${e.message}`.slice(0, 2000)
            : "OCR failed.";
        ocrSucceeded = false;
      }
    } else if (frameCount > 0) {
      processingError =
        "Screenshots were recorded but frame files could not be read for OCR.";
      ocrSucceeded = false;
    }

    // Store OCR (or frame inventory) as transcript evidence for the session.
    if (ocrText) {
      transcript = ocrText.slice(0, 50_000);
    } else if (frameCount) {
      transcript = `Captured ${frameCount} screen frame(s); OCR produced no readable text from ${framesForOcr.length} sampled frame(s).`;
    }

    // Final step only: Groq/LLM analysis on notes + OCR + topics (no vision required).
    if (llmConfigured() && (notesBlock || ocrText || frameCount > 0)) {
      const llm = await callLlm({
        system:
          "You are an ESL teacher assistant. Build lasting lesson memory from the teacher's " +
          "live notes, topic tags, and on-screen text extracted via OCR from screenshots " +
          "taken about every 60 seconds. Do not invent student speech. Prefer concrete " +
          "teachable points grounded in the notes and OCR evidence. Respond with ONLY a JSON object: " +
          '{"summary":"string","autoNotes":"bullet notes string","topicsCovered":["tag"],' +
          '"timeline":[{"minuteOffset":0,"topic":"string"}],"transcript":"short cleaned OCR digest"}',
        user: `Student: ${label}
Teacher tags: ${capture.topicsCovered.join(", ") || "(none)"}
Screen frames captured: ${frameCount} (approx every 60s)
Frames OCR'd: ${framesForOcr.length}
Teacher live notes:
${notesBlock || "(none)"}
OCR text from screenshots (may be noisy; use as evidence of what was on screen):
${ocrText || "(none)"}
Return JSON only.`,
        temperature: 0.4,
        maxTokens: 2000,
      });
      if (llm?.text) {
        const parsed = parseAiPayload(llm.text);
        summary = parsed.summary;
        autoNotes = parsed.autoNotes || autoNotes;
        timeline = parsed.timeline.length ? parsed.timeline : timeline;
        if (parsed.topicsCovered.length) {
          topicsCovered = [...new Set([...topicsCovered, ...parsed.topicsCovered])].slice(0, 20);
        }
        // Prefer structured OCR block we built; allow LLM digest as supplement only if empty.
        if (!transcript && parsed.transcript) transcript = parsed.transcript;
        analysisSucceeded = Boolean(summary || autoNotes);
        if (analysisSucceeded) processingError = null;
      } else if (!processingError) {
        processingError =
          "LLM call failed. Check GROQ_API_KEY (free) or OPENAI_API_KEY / ANTHROPIC_API_KEY, then re-run analysis.";
      }
    }

    if (!summary) {
      if (!llmConfigured()) {
        processingError =
          "No LLM configured. Add a free GROQ_API_KEY from console.groq.com to .env.local (or OPENAI_API_KEY / ANTHROPIC_API_KEY), restart, then re-run analysis.";
        if (notesBlock) {
          summary = notesBlock.slice(0, 2000);
        } else if (ocrText) {
          summary =
            "OCR extracted on-screen text. Add GROQ_API_KEY to generate AI lesson memory, then re-run analysis.";
        } else if (frameCount) {
          summary =
            "Session saved with screenshots. Add GROQ_API_KEY (free) to generate AI lesson memory from notes and OCR, then re-run analysis.";
        } else {
          summary = "Session saved without frames or notes.";
        }
      } else if (processingError) {
        summary = processingError;
      } else if (notesBlock) {
        summary = notesBlock.slice(0, 2000);
      } else if (ocrText) {
        summary = ocrText.slice(0, 2000);
      } else if (frameCount) {
        summary =
          "Session saved with screenshots but AI lesson memory did not produce a summary. Re-run analysis or add typed notes next time.";
      } else {
        summary = "Session saved without frames or notes.";
      }
    }

    if (!timeline.length && capture.liveNotes.length) {
      timeline = capture.liveNotes.map((n) => ({
        minuteOffset: Math.max(0, Math.round((n.createdAt.getTime() - startedMs) / 60_000)),
        topic: n.body.slice(0, 120),
      }));
    }

    // Delete raw frames after successful OCR + analysis (keep structured memory only).
    // Keep frames if OCR or LLM failed so the teacher can re-run.
    if ((analysisSucceeded && ocrSucceeded) || frameCount === 0) {
      await deleteAllSessionFrameBlobs(sessionId);
    }

    await prisma.lessonCaptureSession.update({
      where: { id: sessionId },
      data: {
        status: "ENDED",
        summary,
        autoNotes: autoNotes || null,
        transcript: transcript || null,
        topicsCovered,
        timeline,
        framesCaptured: frameCount,
        processingError: analysisSucceeded ? null : processingError,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Processing failed";
    // Keep frames on unexpected failure so analysis can be retried.
    await prisma.lessonCaptureSession.update({
      where: { id: sessionId },
      data: {
        status: "FAILED",
        processingError: message.slice(0, 2000),
        framesCaptured: frameCount,
      },
    });
  }

  revalidatePath("/teacher/lesson-capture");
  revalidatePath(`/teacher/lesson-capture/${sessionId}`);
}
