import { NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/lib/password-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      token?: unknown;
      password?: unknown;
      confirm?: unknown;
    } | null;
    const token = String(body?.token || "").trim();
    const password = String(body?.password || "");
    const confirm = String(body?.confirm || "");
    if (!token) {
      return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
    }
    if (password !== confirm) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 },
      );
    }

    const result = await consumePasswordResetToken({
      rawToken: token,
      newPassword: password,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/portal/reset-password]", err);
    return NextResponse.json(
      { error: "Could not update password. Please try again." },
      { status: 503 },
    );
  }
}
