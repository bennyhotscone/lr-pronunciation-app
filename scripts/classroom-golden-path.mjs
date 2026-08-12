/**
 * Classroom golden path against production (or localhost).
 * Form-POST join (what browsers do) + teacher create post/lesson/file via Prisma
 * + student must SEE them on classroom + desk.
 *
 * Usage: node scripts/classroom-golden-path.mjs [baseUrl]
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync, writeFileSync } from "fs";
import { put } from "@vercel/blob";

const BASE = (process.argv[2] || "https://lrmastery.guru").replace(/\/$/, "");

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

function cookieJar(res, prev = "") {
  const set = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const map = new Map();
  for (const part of prev.split(";").map((s) => s.trim()).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq > 0) map.set(part.slice(0, eq), part.slice(eq + 1));
  }
  for (const c of set) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(email, password, callbackUrl) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  let cookies = cookieJar(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: callbackUrl || `${BASE}/portal`,
      json: "true",
    }),
    redirect: "manual",
  });
  cookies = cookieJar(loginRes, cookies);
  const session = await (
    await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookies } })
  ).json();
  if (!session?.user?.id) throw new Error(`login failed for ${email}`);
  return { cookies, session };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const prisma = new PrismaClient();
const stamp = Date.now();
const report = { base: BASE, stamp, steps: [], ok: false };

function step(name, data) {
  report.steps.push({ name, ...data });
  console.log(`✓ ${name}`, data && Object.keys(data).length ? JSON.stringify(data) : "");
}

async function main() {
  const teacher = await prisma.user.findUnique({
    where: { email: "teacher@lrmastery.guru" },
  });
  assert(teacher, "seed teacher missing");

  // Remove leftover failed golden classrooms from prior runs
  await prisma.class.deleteMany({
    where: { name: { startsWith: "Golden Path " } },
  });

  let inviteCode = "";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 20; i++) {
    inviteCode = "";
    for (let j = 0; j < 6; j++) inviteCode += chars[Math.floor(Math.random() * chars.length)];
    if (!(await prisma.class.findUnique({ where: { inviteCode } }))) break;
  }
  const klass = await prisma.class.create({
    data: {
      name: `Golden Path ${stamp}`,
      inviteCode,
      teacherId: teacher.id,
    },
  });
  step("create_classroom", { id: klass.id, inviteCode });

  // 2) Create student + login + FORM join (browser-like)
  const studentEmail = `golden.student+${stamp}@lrmastery.guru`;
  const studentPass = `Golden${stamp.toString(36)}!x`;
  const student = await prisma.user.create({
    data: {
      email: studentEmail,
      passwordHash: await bcrypt.hash(studentPass, 10),
      role: "STUDENT",
      profile: {
        create: {
          fullName: "Golden Student",
          preferredName: "Goldie",
          avatarId: "fox",
        },
      },
    },
  });
  const studentLogin = await login(studentEmail, studentPass, `${BASE}/portal/join`);

  const joinRes = await fetch(`${BASE}/api/portal/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: studentLogin.cookies,
      Accept: "text/html",
    },
    body: new URLSearchParams({ code: inviteCode }),
    redirect: "manual",
  });
  const joinLoc = joinRes.headers.get("location") || "";
  assert(
    (joinRes.status === 303 || joinRes.status === 302 || joinRes.status === 307) &&
      (joinLoc.replace(/\/$/, "").endsWith("/portal") || joinLoc.includes("/portal?")),
    `form join failed status=${joinRes.status} loc=${joinLoc}`,
  );
  step("student_form_join", { status: joinRes.status, location: joinLoc });

  const mem = await prisma.classMembership.findUnique({
    where: {
      classId_studentId: { classId: klass.id, studentId: student.id },
    },
  });
  assert(mem?.status === "ACTIVE", "membership not ACTIVE after join");

  // 3) Teacher content: pinned post, lesson+sub, file
  const post = await prisma.classPost.create({
    data: {
      classId: klass.id,
      authorId: teacher.id,
      title: `Pinned welcome ${stamp}`,
      body: "Welcome to golden path class — please introduce yourself.",
      tags: ["welcome", "golden"],
      pinnedAt: new Date(),
    },
  });
  await prisma.classTag.upsert({
    where: { classId_name: { classId: klass.id, name: "welcome" } },
    create: { classId: klass.id, name: "welcome" },
    update: {},
  });

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const lesson = await prisma.classLesson.create({
    data: {
      classId: klass.id,
      createdById: teacher.id,
      day,
      title: `Session ${stamp}`,
      summary: "Covered introductions and classroom norms.",
      tags: ["welcome"],
      subEntries: {
        create: [
          { kind: "TOPIC", title: "Introductions", body: "Say your name", sortOrder: 0 },
          { kind: "HOMEWORK", title: "Practice", body: "Write 3 sentences", sortOrder: 1 },
        ],
      },
    },
  });

  // File via Blob if token present, else local placeholder metadata that download may still fail — require blob for prove
  let resource = null;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    const bytes = Buffer.from(`golden-path file ${stamp}\n`, "utf8");
    const blob = await put(`portal-files/golden-${stamp}.txt`, bytes, {
      access: "public",
      token: blobToken,
      contentType: "text/plain",
    });
    resource = await prisma.resource.create({
      data: {
        title: `Handout ${stamp}`,
        filename: `golden-${stamp}.txt`,
        mimeType: "text/plain",
        sizeBytes: bytes.length,
        blobPath: blob.pathname || `portal-files/golden-${stamp}.txt`,
        blobUrl: blob.url,
        classId: klass.id,
        uploadedById: teacher.id,
        tags: ["welcome"],
        category: "class-file",
      },
    });
    step("teacher_file_blob", { id: resource.id });
  } else {
    step("teacher_file_blob", { skipped: true, reason: "no BLOB_READ_WRITE_TOKEN" });
  }

  step("teacher_content", { postId: post.id, lessonId: lesson.id });

  // Student comment
  await prisma.classPostComment.create({
    data: {
      postId: post.id,
      authorId: student.id,
      body: `Hello from Goldie ${stamp}`,
    },
  });
  step("student_comment", {});

  // 4) Student My Desk must contain class board content (classroom URL redirects here)
  const classRedirect = await fetch(`${BASE}/portal/classrooms/${klass.id}`, {
    headers: { Cookie: studentLogin.cookies },
    redirect: "manual",
  });
  const classLoc = classRedirect.headers.get("location") || "";
  assert(
    (classRedirect.status === 307 || classRedirect.status === 302 || classRedirect.status === 303) &&
      (classLoc.replace(/\/$/, "").endsWith("/portal") || classLoc.includes("/portal?")),
    `classroom should redirect to desk status=${classRedirect.status} loc=${classLoc}`,
  );
  step("classroom_redirects_to_desk", { status: classRedirect.status, location: classLoc });

  const desk = await fetch(`${BASE}/portal`, {
    headers: { Cookie: studentLogin.cookies },
  });
  const deskHtml = await desk.text();
  assert(desk.status === 200, `desk ${desk.status}`);
  assert(deskHtml.includes(klass.name), "desk missing classroom name");
  assert(deskHtml.includes(post.title), "pinned post title missing on desk");
  assert(deskHtml.includes(`Session ${stamp}`) || deskHtml.includes(lesson.title), "lesson missing on desk");
  assert(deskHtml.includes("Introductions"), "lesson sub-entry missing on desk");
  assert(deskHtml.includes(`Hello from Goldie ${stamp}`), "student comment missing on desk");
  if (resource) {
    assert(deskHtml.includes(resource.title), "file title missing on desk");
  }
  step("student_sees_desk_classroom_content", { status: 200 });

  // Teacher board shows student
  const teacherLogin = await login(
    "teacher@lrmastery.guru",
    "TeacherTemp2026!",
    `${BASE}/teacher`,
  );
  const teacherBoard = await fetch(`${BASE}/teacher/classes/${klass.id}`, {
    headers: { Cookie: teacherLogin.cookies },
  });
  const teacherHtml = await teacherBoard.text();
  assert(teacherBoard.status === 200, `teacher board ${teacherBoard.status}`);
  assert(teacherHtml.includes("Goldie") || teacherHtml.includes(studentEmail), "teacher cannot see joined student");
  step("teacher_sees_student", {});

  // Cleanup golden classroom to avoid clutter (optional keep for debug via env)
  if (process.env.GOLDEN_KEEP !== "1") {
    await prisma.class.delete({ where: { id: klass.id } });
    await prisma.user.delete({ where: { id: student.id } }).catch(() => {});
    step("cleanup", { deleted: true });
  }

  report.ok = true;
  writeFileSync("golden-path-report.json", JSON.stringify(report, null, 2));
  console.log("\nGOLDEN PATH OK");
}

main()
  .catch((e) => {
    report.ok = false;
    report.error = String(e?.stack || e);
    writeFileSync("golden-path-report.json", JSON.stringify(report, null, 2));
    console.error("\nGOLDEN PATH FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
