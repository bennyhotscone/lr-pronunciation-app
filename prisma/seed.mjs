import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Sole seed admin — change password after first production login. */
const ADMIN_EMAIL = "teacher@lrmastery.guru";
const ADMIN_PASSWORD = "TeacherTemp2026!";

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      role: "ADMIN",
      archivedAt: null,
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
      profile: {
        create: {
          fullName: "LR Mastery Admin",
          preferredName: "Admin",
          avatarId: "book",
        },
      },
    },
  });

  // Ensure profile preferred name if user already existed without profile update path
  await prisma.studentProfile.upsert({
    where: { userId: admin.id },
    create: {
      userId: admin.id,
      fullName: "LR Mastery Admin",
      preferredName: "Admin",
      avatarId: "book",
    },
    update: {
      preferredName: "Admin",
    },
  });

  // Keep Rita's class after DB re-provision / seed (stable id + invite code).
  const RITA_CLASS_ID = "cmso22jkg0001s1a0mozrffu7";
  const RITA_INVITE = "7GHW4L";
  const RITA_NAME = "Rita's class";

  let rita = await prisma.class.findUnique({ where: { id: RITA_CLASS_ID } });
  if (!rita) {
    rita = await prisma.class.findUnique({ where: { inviteCode: RITA_INVITE } });
  }
  if (!rita) {
    rita = await prisma.class.findFirst({
      where: {
        name: { equals: RITA_NAME, mode: "insensitive" },
        teacherId: admin.id,
        archivedAt: null,
      },
    });
  }
  if (!rita) {
    rita = await prisma.class.create({
      data: {
        id: RITA_CLASS_ID,
        name: RITA_NAME,
        description: "Rita's classroom",
        inviteCode: RITA_INVITE,
        teacherId: admin.id,
      },
    });
    console.log(`Seeded classroom: ${rita.name} · code ${rita.inviteCode}`);
  } else {
    // Ensure ownership / not archived after re-seed
    rita = await prisma.class.update({
      where: { id: rita.id },
      data: {
        teacherId: admin.id,
        archivedAt: null,
        name: RITA_NAME,
        inviteCode: rita.inviteCode || RITA_INVITE,
      },
    });
    console.log(`Ensured classroom: ${rita.name} · code ${rita.inviteCode}`);
  }

  console.log("Seeded admin:");
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);
  console.log(`  role:     ADMIN`);
  console.log(`  id:       ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
