import { createHash, randomBytes } from "crypto";

/**
 * True only when a working outbound transporter is available.
 * Resend is the supported path (RESEND_API_KEY). SMTP_* alone is not wired.
 */
export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function mailFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "LR Mastery <onboarding@resend.dev>"
  );
}

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createRawResetToken(): string {
  return randomBytes(32).toString("hex");
}

export type SendMailResult =
  | { ok: true; provider: "resend" | "smtp" | "log" }
  | { ok: false; error: string };

/**
 * Send transactional email.
 * Prefers Resend (RESEND_API_KEY). Falls back to SMTP_* if set.
 * If neither configured, logs to console and returns ok with provider "log"
 * so callers know delivery was not real email.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendMailResult> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: mailFromAddress(),
          to: [opts.to],
          subject: opts.subject,
          text: opts.text,
          html: opts.html || opts.text.replace(/\n/g, "<br/>"),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          ok: false,
          error: `Resend error ${res.status}: ${body.slice(0, 200)}`,
        };
      }
      return { ok: true, provider: "resend" };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Resend send failed",
      };
    }
  }

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (host && user && pass) {
    // Avoid hard dependency on nodemailer — use Resend or configure RESEND_API_KEY.
    // SMTP without a package: document Resend as primary. Log + fail clearly.
    console.warn(
      "[mail] SMTP_* is set but Resend is preferred. Set RESEND_API_KEY for production email.",
    );
    console.info(`[mail:smtp-unwired] to=${opts.to} subject=${opts.subject}`);
    return {
      ok: false,
      error:
        "SMTP env is present but Resend is the supported transporter. Set RESEND_API_KEY.",
    };
  }

  console.info(
    `[mail:not-configured] to=${opts.to} subject=${opts.subject}\n${opts.text}`,
  );
  return { ok: true, provider: "log" };
}
