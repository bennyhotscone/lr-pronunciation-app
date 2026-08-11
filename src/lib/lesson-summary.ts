/** Zero-cost lesson summary — no LLM, no API keys, no running cost. */

export type LessonSummaryInput = {
  title?: string | null;
  summary?: string | null;
  subEntries?: { kind: string; title: string; body?: string | null }[];
  tags?: string[];
};

/**
 * Builds a short student-facing summary from what the teacher already wrote.
 * Prefer the teacher's summary paragraph; otherwise assemble from title + sub-entries.
 */
export function buildFreeLessonSummary(input: LessonSummaryInput): string {
  const teacherSummary = (input.summary || "").trim();
  if (teacherSummary) {
    return teacherSummary.length > 480
      ? `${teacherSummary.slice(0, 477).trim()}…`
      : teacherSummary;
  }

  const parts: string[] = [];
  const title = (input.title || "").trim();
  if (title) parts.push(`This lesson focused on ${title}.`);

  const subs = (input.subEntries || []).filter((s) => s.title?.trim());
  const topics = subs.filter((s) => s.kind === "TOPIC").map((s) => s.title.trim());
  const homework = subs.filter((s) => s.kind === "HOMEWORK").map((s) => s.title.trim());
  const notes = subs
    .filter((s) => s.kind !== "TOPIC" && s.kind !== "HOMEWORK")
    .map((s) => s.title.trim());

  if (topics.length) {
    parts.push(
      topics.length === 1
        ? `Main topic: ${topics[0]}.`
        : `Topics covered: ${topics.slice(0, 5).join("; ")}${topics.length > 5 ? "…" : ""}.`,
    );
  }
  if (notes.length) {
    parts.push(`Also noted: ${notes.slice(0, 4).join("; ")}.`);
  }
  if (homework.length) {
    parts.push(
      homework.length === 1
        ? `Homework: ${homework[0]}.`
        : `Homework: ${homework.slice(0, 3).join("; ")}.`,
    );
  }
  if (input.tags?.length) {
    parts.push(`Tags: ${input.tags.slice(0, 6).join(", ")}.`);
  }

  if (!parts.length) {
    return "No summary yet — your teacher can add a lesson summary or sub-entries.";
  }
  return parts.join(" ");
}
