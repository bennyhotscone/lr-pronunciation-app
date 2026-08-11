import { prisma } from "@/lib/db";
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
  /** Always true-ish for enumeration resistance on public form */
  accepted: true;
  mailed: boolean;
  mailConfigured: boolean;
  /** Only returned for staff-initiated resets (copyable link) */
  resetUrl?: string;
  error?: string;
}> {
  const email = opts.email.trim().toLowerCase();
  const mailConfigured = isMailConfigured();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.archivedAt) {
    return { accepted: true, mailed: false, mailConfigured };
  }

  // Invalidate prior unused tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const raw = createRawResetToken();
  const tokenHash = hashResetToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${opts.origin.replace(/\/$/, "")}/reset-password?token=${raw}`;

  const text = [
    "Reset your LR Mastery password",
    "",
    "Use this one-time link within 1 hour:",
    resetUrl,
    "",
    "If you did not request this, ignore this email.",
  ].join("\n");

  const mail = await sendMail({
    to: user.email,
    subject: "Reset your LR Mastery password",
    text,
  });

  if (mail.ok && mail.provider !== "log") {
    return { accepted: true, mailed: true, mailConfigured: true };
  }

  // Mail not configured or send failed — token still exists in DB.
  // Log URL for operators (Vercel function logs).
  console.info(`[password-reset] token issued for ${user.email}: ${resetUrl}`);
  if (!mail.ok) {
    return {
      accepted: true,
      mailed: false,
      mailConfigured,
      error: mail.error,
    };
  }
  return { accepted: true, mailed: false, mailConfigured: false };
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
  const row = await prisma.passwordResetToken.findUnique({
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
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}
