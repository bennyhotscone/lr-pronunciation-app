import { NextResponse } from "next/server";
import { STUDIO_PASSWORD_FALLBACK } from "@/lib/studio-progress";

export async function POST(request: Request) {
  let body: { password?: string } = {};
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const expected =
    process.env.MANDARIN_STUDIO_PASSWORD?.trim() || STUDIO_PASSWORD_FALLBACK;
  const ok = typeof body.password === "string" && body.password === expected;
  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
