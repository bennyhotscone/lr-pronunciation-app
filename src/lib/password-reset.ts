import { withPrismaRetry } from "@/lib/db";
import {
  createRawResetToken,
  hashResetToken,
  isMailConfigured,
  sendMail,
} from "@/lib/mail";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function issuePasswordResetForEmail(opts: {
  email: string;
  origin: string;
}): Promise<{
  accepted: true;
  mailed: boolean;
  mailConfigured: boolean;
  resetUrl?: string;
  error?: string;
}> {
  const email = opts.email.trim().toLowerCase();
  const mailConfigured = isMailConfigured();

  const result = await withPrismaRetry(async (db) => {
    const user = await db.user.findUnique({ where: { email } });
    if (!user || user.archivedAt) {
      return { accepted: true as const, mailed: false, mailConfigured };
    }

    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const raw = createRawResetToken();
    const tokenHash = hashResetToken(raw);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return {
      accepted: true as const,
      mailed: false,
      mailConfigured,
      resetUrl: `${opts.origin.replace(/\/$/, "")}/reset-password?token=${raw}`,
      userEmail: user.email,
    };
  });

  if (!("resetUrl" in result) || !result.resetUrl || !("userEmail" in result)) {
    return { accepted: true, mailed: false, mailConfigured };
  }

  const resetUrl = result.resetUrl;
  const text = [
    "Reset your LR Mastery password",
    "",
    "Use this one-time link within 1 hour:",
    resetUrl,
    "",
    "If you did not request this, ignore this email.",
  ].join("\n");

  if (mailConfigured) {
    const mail = await sendMail({
      to: result.userEmail,
      subject: "Reset your LR Mastery password",
      text,
    });

    if (mail.ok && mail.provider !== "log") {
      return { accepted: true, mailed: true, mailConfigured: true };
    }

    console.info(
      `[password-reset] mail failed for ${result.userEmail}; showing link. ${mail.ok ? "provider=log" : mail.error}`,
    );
    return {
      accepted: true,
      mailed: false,
      mailConfigured: true,
      resetUrl,
      error: mail.ok ? undefined : mail.error,
    };
  }

  console.info(`[password-reset] no mail configured; on-page link for ${result.userEmail}`);
  return { accepted: true, mailed: false, mailConfigured: false, resetUrl };
}

export async function consumePasswordResetToken(opts: {
  rawToken: string;
  newPassword: string;
}): Promise<{ ok: true } | { error: string }> {
  const raw = opts.rawToken.trim();
  if (!raw || raw.length < 20) return { error: "Invalid or expired reset link." };
  if (opts.newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const tokenHash = hashResetToken(raw);

  try {
    return await withPrismaRetry(async (db) => {
      const row = await db.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
        return { error: "Invalid or expired reset link." };
      }
      if (row.user.archivedAt) {
        return { error: "This account is not active." };
      }

      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(opts.newPassword, 10);
      await db.$transaction([
        db.user.update({
          where: { id: row.userId },
          data: { passwordHash },
        }),
        db.passwordResetToken.update({
          where: { id: row.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return { ok: true as const };
    });
  } catch (err) {
    console.error("[password-reset] consume failed", err);
    return { error: "Could not update password. Please try again." };
  }
}
