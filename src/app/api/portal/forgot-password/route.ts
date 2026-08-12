import { NextResponse } from "next/server";
import { issuePasswordResetForEmail } from "@/lib/password-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Keep short — never hang the browser on Working… */
export const maxDuration = 20;

function originFromRequest(req: Request): string {
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.url.startsWith("http://") ? "http" : "https");
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      email?: unknown;
    } | null;
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "Enter your email address." },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    const result = await issuePasswordResetForEmail({
      email,
      origin: originFromRequest(req),
    });

    let message: string;
    if (result.mailed) {
      message =
        "If an account exists for that email, a reset link was emailed. Check your inbox (and spam).";
    } else if (result.resetUrl) {
      message = result.mailConfigured
        ? "Email sending failed. Use this one-time link to set a new password (valid 1 hour)."
        : "Email is not configured on this server. Use this one-time link to set a new password (valid 1 hour).";
    } else if (result.mailConfigured) {
      message =
        "If an account exists for that email, a reset link was emailed. Check your inbox (and spam).";
    } else {
      message =
        "No reset link to show for that email. Check the address, or ask your teacher to set a new password from your student page.";
    }

    return NextResponse.json({
      ok: true,
      mailed: result.mailed,
      mailConfigured: result.mailConfigured,
      resetUrl: result.resetUrl ?? null,
      message,
    });
  } catch (err) {
    console.error("[api/portal/forgot-password]", err);
    return NextResponse.json(
      {
        error:
          "Could not create a reset link right now. Please try again in a moment.",
      },
      { status: 503 },
    );
  }
}
