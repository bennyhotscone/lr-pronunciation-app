import { NextResponse } from "next/server";
import { checkStudioPassword } from "@/lib/studio-auth";

export async function POST(request: Request) {
  let body: { password?: string } = {};
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const ok = checkStudioPassword(body.password);
  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
