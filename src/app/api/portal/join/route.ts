import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enrollStudentWithInviteCode } from "@/lib/enroll-student";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in as a student to join a classroom.", needAuth: true },
      { status: 401 },
    );
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      {
        error:
          "This account is a teacher/admin. Log out and use a student account to join.",
        needAuth: false,
      },
      { status: 403 },
    );
  }

  let code = "";
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { code?: string } | null;
    code = String(body?.code || "");
  } else {
    const fd = await req.formData().catch(() => null);
    code = String(fd?.get("code") || "");
  }

  const result = await enrollStudentWithInviteCode(session.user.id, code, {
    revalidate: true,
  });

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    classId: result.classId,
    className: result.className,
  });
}
