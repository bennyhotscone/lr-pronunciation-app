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
  const STUDENT_TEMP_PASSWORD = "StudentTemp2026!";

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
        inviteCode: RITA_INVITE,
      },
    });
    console.log(`Ensured classroom: ${rita.name} · code ${rita.inviteCode}`);
  }

  // Known production students — recreate after DB wipe so they stay in Rita's class.
  const studentHash = await bcrypt.hash(STUDENT_TEMP_PASSWORD, 10);
  const knownStudents = [
    {
      email: "djsundad@gmail.com",
      fullName: "DJ",
      preferredName: "DJ",
      avatarId: "rocket",
    },
    {
      email: "rita@lrmastery.guru",
      fullName: "Rita",
      preferredName: "Rita",
      avatarId: "book",
    },
  ];

  for (const spec of knownStudents) {
    let student = await prisma.user.findUnique({ where: { email: spec.email } });
    if (!student) {
      student = await prisma.user.create({
        data: {
          email: spec.email,
          passwordHash: studentHash,
          role: "STUDENT",
          profile: {
            create: {
              fullName: spec.fullName,
              preferredName: spec.preferredName,
              avatarId: spec.avatarId,
            },
          },
        },
      });
      console.log(`Seeded student: ${spec.email}`);
    } else {
      student = await prisma.user.update({
        where: { id: student.id },
        data: {
          role: "STUDENT",
          archivedAt: null,
          // Do not overwrite password on every seed if already exists — only create sets it.
        },
      });
      await prisma.studentProfile.upsert({
        where: { userId: student.id },
        create: {
          userId: student.id,
          fullName: spec.fullName,
          preferredName: spec.preferredName,
          avatarId: spec.avatarId,
        },
        update: {
          preferredName: spec.preferredName,
          fullName: spec.fullName,
        },
      });
      console.log(`Ensured student: ${spec.email}`);
    }

    const existing = await prisma.classMembership.findFirst({
      where: { classId: rita.id, studentId: student.id },
    });
    if (existing) {
      await prisma.classMembership.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", leftAt: null },
      });
    } else {
      await prisma.classMembership.create({
        data: { classId: rita.id, studentId: student.id, status: "ACTIVE" },
      });
    }
  }

  // Sample feed if empty (narrative-tenses style) so teacher/student boards aren't blank after wipe.
  const postCount = await prisma.classPost.count({ where: { classId: rita.id } });
  if (postCount === 0) {
    await prisma.classPost.create({
      data: {
        classId: rita.id,
        authorId: admin.id,
        title: "Welcome to Rita's class",
        body: "Hi everyone — this is our shared classroom board.\n\nYou'll find lesson writeups, homework notes, and files here.",
        tags: ["welcome"],
        pinnedAt: new Date(),
      },
    });
    await prisma.classPost.create({
      data: {
        classId: rita.id,
        authorId: admin.id,
        title: "Homework: short story with narrative tenses",
        body: "Write 8–10 sentences about something that happened last week.\n\nUse Past Simple, Past Continuous, and Past Perfect once.",
        tags: ["narrative tenses", "homework"],
      },
    });
    console.log("Seeded sample stream posts");
  }

  const day = new Date("2026-08-05T00:00:00.000Z");
  const lessonExists = await prisma.classLesson.findUnique({
    where: { classId_day: { classId: rita.id, day } },
  });
  if (!lessonExists) {
    await prisma.classLesson.create({
      data: {
        classId: rita.id,
        day,
        title: "Narrative tenses",
        summary:
          "Past simple for main events, past continuous for background, past perfect for earlier past.",
        tags: ["narrative tenses"],
        createdById: admin.id,
        subEntries: {
          create: [
            { kind: "TOPIC", title: "Past Simple for main events", sortOrder: 0 },
            { kind: "TOPIC", title: "Past Continuous for background", sortOrder: 1 },
            { kind: "TOPIC", title: "Past Perfect for earlier past", sortOrder: 2 },
            {
              kind: "HOMEWORK",
              title: "Write a short story (8–10 sentences)",
              sortOrder: 3,
            },
          ],
        },
      },
    });
    console.log("Seeded sample narrative-tenses lesson");
  }

  console.log("Seeded admin:");
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);
  console.log(`  role:     ADMIN`);
  console.log(`  id:       ${admin.id}`);
  console.log("Known students (recreated if missing):");
  console.log(`  djsundad@gmail.com / ${STUDENT_TEMP_PASSWORD} (DJ)`);
  console.log(`  rita@lrmastery.guru / ${STUDENT_TEMP_PASSWORD} (Rita)`);
  console.log(`  class:    ${rita.name} · invite ${rita.inviteCode}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
