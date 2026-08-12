import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enrollStudentWithInviteCode } from "@/lib/enroll-student";

function wantsJson(req: Request) {
  const accept = req.headers.get("accept") || "";
  const ct = req.headers.get("content-type") || "";
  return ct.includes("application/json") || accept.includes("application/json");
}

async function readCode(req: Request): Promise<string> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { code?: string } | null;
    return String(body?.code || "");
  }
  const fd = await req.formData().catch(() => null);
  return String(fd?.get("code") || "");
}

export async function POST(req: Request) {
  const json = wantsJson(req);
  const session = await auth();
  const origin = new URL(req.url).origin;

  if (!session?.user?.id) {
    if (json) {
      return NextResponse.json(
        { error: "Sign in as a student to join a classroom.", needAuth: true },
        { status: 401 },
      );
    }
    const code = await readCode(req).catch(() => "");
    const cb = code ? `/join/${code}` : "/portal/join";
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(cb)}`, origin),
      303,
    );
  }

  if (session.user.role !== "STUDENT") {
    if (json) {
      return NextResponse.json(
        {
          error:
            "This account is a teacher/admin. Log out and use a student account to join.",
        },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/teacher?join=student-only", origin), 303);
  }

  const code = await readCode(req);
  const result = await enrollStudentWithInviteCode(session.user.id, code, {
    revalidate: true,
  });

  if ("error" in result && result.error) {
    if (json) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const u = new URL("/portal/join", origin);
    u.searchParams.set("error", result.error);
    if (code) u.searchParams.set("code", code);
    return NextResponse.redirect(u, 303);
  }

  if (json) {
    return NextResponse.json({
      ok: true,
      classId: result.classId,
      className: result.className,
    });
  }

  return NextResponse.redirect(new URL("/portal", origin), 303);
}
