"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/portal-access";
import { revalidatePath } from "next/cache";

export async function teacherAwardMoney(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) {
    return { error: "Unauthorized" };
  }

  const studentId = String(formData.get("studentId") || "").trim();
  const reason = String(formData.get("reason") || "").trim().slice(0, 200);
  const amountRaw = String(formData.get("amount") || "").trim();
  const amount = Number.parseInt(amountRaw, 10);

  if (!studentId) return { error: "Missing student." };
  if (!Number.isFinite(amount) || amount === 0) {
    return { error: "Enter a non-zero whole-number amount." };
  }
  if (Math.abs(amount) > 500) return { error: "Amount must be between -500 and 500." };
  if (!reason) return { error: "Add a short reason." };

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT" },
    select: { id: true },
  });
  if (!student) return { error: "Student not found." };

  try {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.classWallet.upsert({
        where: { studentId },
        create: { studentId, balance: 0 },
        update: {},
      });
      const next = wallet.balance + amount;
      if (next < 0) {
        throw new Error("NEGATIVE");
      }
      await tx.moneyLedger.create({
        data: {
          walletId: wallet.id,
          amount,
          reason,
          awardedById: session.user.id,
        },
      });
      await tx.classWallet.update({
        where: { id: wallet.id },
        data: { balance: next },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NEGATIVE") {
      return { error: "Balance cannot go below zero." };
    }
    return { error: "Could not update money." };
  }

  revalidatePath("/portal");
  revalidatePath(`/teacher/students/${studentId}`);
  return { ok: true as const };
}

export async function getOrCreateWalletBalance(studentId: string) {
  const wallet = await prisma.classWallet.upsert({
    where: { studentId },
    create: { studentId, balance: 0 },
    update: {},
    select: { balance: true },
  });
  return wallet.balance;
}