import { NextResponse } from "next/server";
import { requireStudioAdmin } from "@/lib/studio-auth";

/** Studio gate: ADMIN session only (replaces shared password as primary auth). */
export async function GET() {
  const session = await requireStudioAdmin();
  if (!session) {
    return NextResponse.json({ ok: false, admin: false }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    admin: true,
    email: session.user.email ?? null,
  });
}

/** Legacy password check retained for tooling; page unlock uses GET + admin session. */
export async function POST(request: Request) {
  const session = await requireStudioAdmin();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Admin login required" },
      { status: 401 },
    );
  }
  // Ignore body password — session is the source of truth.
  void request;
  return NextResponse.json({ ok: true, admin: true });
}
