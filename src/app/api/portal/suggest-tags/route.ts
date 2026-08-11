import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertTeacherOwnsClass, isStaff } from "@/lib/portal-access";

export const runtime = "nodejs";

function heuristicTags(title: string, body: string, known: string[]): string[] {
  const text = `${title} ${body}`.toLowerCase();
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "have",
    "your",
    "class",
    "today",
    "lesson",
    "students",
    "please",
    "about",
    "into",
    "will",
    "they",
    "them",
    "were",
    "been",
    "also",
  ]);
  const words = text
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stop.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  const ranked = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 8);
  const fromKnown = known.filter((k) => text.includes(k)).slice(0, 5);
  return [...new Set([...fromKnown, ...ranked])].slice(0, 10);
}

async function llmSuggest(title: string, body: string, known: string[]): Promise<string[] | null> {
  const key = process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;

  const prompt = `Suggest 5-8 short topic tags (1-3 words each) for a classroom post/lesson. Return JSON array of strings only.
Known classroom tags (prefer reusing when relevant): ${known.slice(0, 30).join(", ") || "(none)"}
Title: ${title.slice(0, 200)}
Body: ${body.slice(0, 1200)}`;

  try {
    if (process.env.OPENAI_API_KEY?.trim()) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_TAG_MODEL?.trim() || "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 120,
          messages: [
            { role: "system", content: "You only reply with a JSON array of short tag strings." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content || "[]";
      const match = content.match(/\[[\s\S]*\]/);
      const arr = JSON.parse(match?.[0] || "[]") as unknown;
      if (!Array.isArray(arr)) return null;
      return arr.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10);
    }

    // Anthropic Messages API
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(),
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_TAG_MODEL?.trim() || "claude-3-5-haiku-latest",
        max_tokens: 120,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text || "[]";
    const match = text.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(match?.[0] || "[]") as unknown;
    if (!Array.isArray(arr)) return null;
    return arr.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { classId?: string; title?: string; body?: string; knownTags?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const classId = String(body.classId || "");
  if (!classId) return NextResponse.json({ error: "classId required" }, { status: 400 });
  try {
    await assertTeacherOwnsClass(session.user.id, classId, session.user.role);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const knownFromDb = await prisma.classTag.findMany({
    where: { classId },
    select: { name: true },
    take: 50,
  });
  const known = [
    ...new Set([
      ...(Array.isArray(body.knownTags) ? body.knownTags.map(String) : []),
      ...knownFromDb.map((t) => t.name),
    ]),
  ];

  const title = String(body.title || "");
  const text = String(body.body || "");
  const llm = await llmSuggest(title, text, known);
  if (llm?.length) {
    return NextResponse.json({ tags: llm, source: "llm" });
  }
  return NextResponse.json({
    tags: heuristicTags(title, text, known),
    source: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY ? "heuristic" : "heuristic",
  });
}
