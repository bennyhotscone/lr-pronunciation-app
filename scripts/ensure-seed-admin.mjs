import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";

for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* */
  }
}

const EMAIL = "teacher@lrmastery.guru";
const PASSWORD = "TeacherTemp2026!";

const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRaw`SELECT 1 as ok`;
  console.log("dbAlive: true");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      role: "ADMIN",
      archivedAt: null,
    },
    create: {
      email: EMAIL,
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

  await prisma.studentProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      fullName: "LR Mastery Admin",
      preferredName: "Admin",
      avatarId: "book",
    },
    update: {},
  });

  const ok = await bcrypt.compare(PASSWORD, user.passwordHash);
  // Re-fetch after upsert in case update path
  const again = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  const ok2 = await bcrypt.compare(PASSWORD, again.passwordHash);

  console.log(
    JSON.stringify(
      {
        email: EMAIL,
        password: PASSWORD,
        role: again.role,
        id: again.id,
        passwordOk: ok2,
        note: "Re-seeded ADMIN + password hash",
      },
      null,
      2,
    ),
  );

  if (again.role !== "ADMIN" || !ok2) {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("FATAL", e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
