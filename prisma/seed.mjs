import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEACHER_EMAIL = "teacher@lrmastery.guru";
const TEACHER_PASSWORD = "TeacherTemp2026!";

async function main() {
  const passwordHash = await bcrypt.hash(TEACHER_PASSWORD, 10);

  const teacher = await prisma.user.upsert({
    where: { email: TEACHER_EMAIL },
    update: {
      passwordHash,
      role: "TEACHER",
      archivedAt: null,
    },
    create: {
      email: TEACHER_EMAIL,
      passwordHash,
      role: "TEACHER",
      profile: {
        create: {
          fullName: "LR Mastery Teacher",
          preferredName: "Teacher",
          avatarId: "book",
        },
      },
    },
  });

  console.log("Seeded teacher:");
  console.log(`  email:    ${TEACHER_EMAIL}`);
  console.log(`  password: ${TEACHER_PASSWORD}`);
  console.log(`  id:       ${teacher.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
