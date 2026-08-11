import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync, writeFileSync } from "fs";

function loadEnvLocal() {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
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
}

loadEnvLocal();

const prisma = new PrismaClient();

async function main() {
  const teacher = await prisma.user.findUnique({
    where: { email: "teacher@lrmastery.guru" },
  });
  if (!teacher) throw new Error("Teacher not seeded");

  const email = `student.mvp+${Date.now()}@lrmastery.guru`;
  const temp = "StudentTemp2026!";
  const hash = await bcrypt.hash(temp, 10);
  const student = await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      role: "STUDENT",
      profile: {
        create: {
          fullName: "MVP Student",
          preferredName: "Mivi",
          avatarId: "rocket",
        },
      },
    },
  });

  const klass = await prisma.class.create({
    data: {
      name: "MVP Class",
      teacherId: teacher.id,
      description: "E2E",
    },
  });

  await prisma.classMembership.create({
    data: { classId: klass.id, studentId: student.id, status: "ACTIVE" },
  });

  await prisma.lesson.create({
    data: {
      title: "Week 1 Sounds",
      summary: "Intro L/R",
      classId: klass.id,
      createdById: teacher.id,
      tags: ["sounds"],
    },
  });

  await prisma.resource.create({
    data: {
      title: "Worksheet PDF",
      filename: "worksheet.txt",
      blobPath: `portal-files/${klass.id}/demo.txt`,
      blobUrl: "/portal-uploads/demo.txt",
      mimeType: "text/plain",
      classId: klass.id,
      uploadedById: teacher.id,
      category: "class",
    },
  });

  await prisma.homework.create({
    data: {
      title: "Practice pairs",
      instructions: "Do page 1",
      classId: klass.id,
      createdById: teacher.id,
    },
  });

  await prisma.resource.create({
    data: {
      title: "Personal tip sheet",
      filename: "tip.txt",
      blobPath: `portal-files/${student.id}/tip.txt`,
      blobUrl: "/portal-uploads/tip.txt",
      mimeType: "text/plain",
      studentId: student.id,
      uploadedById: teacher.id,
      category: "just-for-you",
    },
  });

  const classIds = (
    await prisma.classMembership.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      select: { classId: true },
    })
  ).map((r) => r.classId);

  const deskFiles = await prisma.resource.findMany({
    where: {
      OR: [{ studentId: student.id }, { classId: { in: classIds } }],
    },
  });

  const summary = {
    ok: true,
    teacherEmail: "teacher@lrmastery.guru",
    studentEmail: email,
    studentPassword: temp,
    classId: klass.id,
    deskFileTitles: deskFiles.map((f) => f.title),
  };
  writeFileSync(
    new URL("./.last-e2e-student.json", import.meta.url),
    JSON.stringify(
      { studentEmail: email, studentPassword: temp, classId: klass.id },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
