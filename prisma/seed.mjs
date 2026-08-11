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
