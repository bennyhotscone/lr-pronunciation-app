/**
 * Localhost Auth.js + portal smoke test (credentials login → protected pages).
 * Usage: node scripts/portal-http-e2e.mjs
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

function loadEnvLocal() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(file, "utf8");
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
    } catch {
      /* missing file ok */
    }
  }
}

loadEnvLocal();

const BASE = process.env.PORTAL_E2E_BASE || "http://localhost:3000";
const TEACHER_EMAIL = "teacher@lrmastery.guru";
const TEACHER_PASSWORD = "TeacherTemp2026!";

function cookieJar() {
  const jar = new Map();
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || [];
      for (const c of raw) {
        const [pair] = c.split(";");
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        jar.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
      // fallback for older undici
      const single = res.headers.get("set-cookie");
      if (single && !raw.length) {
        for (const part of single.split(/,(?=\s*[^;]+=)/)) {
          const [pair] = part.trim().split(";");
          const eq = pair.indexOf("=");
          if (eq === -1) continue;
          jar.set(pair.slice(0, eq), pair.slice(eq + 1));
        }
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    clear() {
      jar.clear();
    },
  };
}

async function fetchFollow(url, opts = {}, jar, maxRedirects = 8) {
  let current = url;
  let method = opts.method || "GET";
  let body = opts.body;
  let headers = { ...(opts.headers || {}) };
  for (let i = 0; i <= maxRedirects; i++) {
    headers.Cookie = jar.header();
    const res = await fetch(current, {
      method,
      body,
      headers,
      redirect: "manual",
    });
    jar.store(res);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`Redirect without Location from ${current}`);
      current = new URL(loc, current).toString();
      if (res.status === 303 || (res.status === 302 && method === "POST")) {
        method = "GET";
        body = undefined;
        headers = { ...(opts.headers || {}) };
        delete headers["Content-Type"];
      }
      continue;
    }
    const text = await res.text();
    return { res, text, url: current };
  }
  throw new Error("Too many redirects");
}

async function login(email, password, jar) {
  jar.clear();
  // Prime CSRF / session cookies
  await fetchFollow(`${BASE}/login`, {}, jar);
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { Cookie: jar.header() },
  });
  jar.store(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/`,
    json: "true",
  });

  const { res, text, url } = await fetchFollow(
    `${BASE}/api/auth/callback/credentials`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    jar,
  );

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: jar.header() },
  });
  jar.store(sessionRes);
  const session = await sessionRes.json();
  if (!session?.user) {
    throw new Error(
      `Login failed for ${email}. status=${res.status} url=${url} body=${text.slice(0, 200)} session=${JSON.stringify(session)}`,
    );
  }
  return session;
}

async function main() {
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const studentEmail = `student.http+${stamp}@lrmastery.guru`;
  const studentPassword = "StudentHttp2026!";

  const teacher = await prisma.user.findUnique({
    where: { email: TEACHER_EMAIL },
  });
  if (!teacher) throw new Error("Teacher missing — run npm run db:seed");
  const pwOk = await bcrypt.compare(TEACHER_PASSWORD, teacher.passwordHash);
  if (!pwOk) throw new Error("Teacher password hash mismatch");

  const student = await prisma.user.create({
    data: {
      email: studentEmail,
      passwordHash: await bcrypt.hash(studentPassword, 10),
      role: "STUDENT",
      profile: {
        create: {
          fullName: "HTTP E2E Student",
          preferredName: "HttpStu",
          avatarId: "fox",
        },
      },
    },
  });

  const klass = await prisma.class.create({
    data: {
      name: `HTTP Class ${stamp}`,
      teacherId: teacher.id,
    },
  });
  await prisma.classMembership.create({
    data: { classId: klass.id, studentId: student.id, status: "ACTIVE" },
  });
  await prisma.lesson.create({
    data: {
      title: "HTTP Lesson Alpha",
      summary: "Visible on student desk",
      classId: klass.id,
      createdById: teacher.id,
    },
  });

  // Local upload fallback file so My Desk link resolves
  const uploadDir = path.join(process.cwd(), "public", "portal-uploads", klass.id);
  mkdirSync(uploadDir, { recursive: true });
  const localName = `note-${stamp}.txt`;
  writeFileSync(path.join(uploadDir, localName), "class worksheet content");
  await prisma.resource.create({
    data: {
      title: "HTTP Class File",
      filename: localName,
      blobPath: `portal-files/${klass.id}/${localName}`,
      blobUrl: `/portal-uploads/${klass.id}/${localName}`,
      mimeType: "text/plain",
      classId: klass.id,
      uploadedById: teacher.id,
      category: "class",
    },
  });

  // Unauth redirects
  const jar0 = cookieJar();
  const portalUnauth = await fetchFollow(`${BASE}/portal`, {}, jar0);
  if (!portalUnauth.url.includes("/login")) {
    throw new Error(`Expected /portal → /login, got ${portalUnauth.url}`);
  }
  const teacherUnauth = await fetchFollow(`${BASE}/teacher`, {}, cookieJar());
  if (!teacherUnauth.url.includes("/login")) {
    throw new Error(`Expected /teacher → /login, got ${teacherUnauth.url}`);
  }

  // Teacher login
  const tJar = cookieJar();
  const tSession = await login(TEACHER_EMAIL, TEACHER_PASSWORD, tJar);
  if (tSession.user.role !== "TEACHER") {
    throw new Error(`Teacher role wrong: ${JSON.stringify(tSession.user)}`);
  }
  const teacherPage = await fetchFollow(`${BASE}/teacher`, {}, tJar);
  if (teacherPage.res.status !== 200 || !teacherPage.text.includes("Teacher dashboard")) {
    throw new Error(`Teacher page failed status=${teacherPage.res.status}`);
  }
  if (!teacherPage.text.includes(studentEmail) && !teacherPage.text.includes("HTTP E2E")) {
    // student list shows preferred/full name
    if (!teacherPage.text.includes("HttpStu") && !teacherPage.text.includes("HTTP E2E Student")) {
      throw new Error("Teacher dashboard missing newly created student");
    }
  }

  // Student denied from teacher
  const sJar = cookieJar();
  await login(studentEmail, studentPassword, sJar);
  const studentOnTeacher = await fetchFollow(`${BASE}/teacher`, {}, sJar);
  if (studentOnTeacher.url.includes("/teacher") && studentOnTeacher.res.status === 200) {
    // middleware should bounce to /portal
    if (!studentOnTeacher.url.includes("/portal") && studentOnTeacher.text.includes("Teacher dashboard")) {
      throw new Error("Student could open teacher dashboard");
    }
  }

  const desk = await fetchFollow(`${BASE}/portal`, {}, sJar);
  if (desk.res.status !== 200) throw new Error(`My Desk status ${desk.res.status}`);
  for (const needle of ["My Desk", "HTTP Lesson Alpha", "HTTP Class File"]) {
    if (!desk.text.includes(needle)) {
      throw new Error(`My Desk missing "${needle}"`);
    }
  }

  const profile = await fetchFollow(`${BASE}/portal/profile`, {}, sJar);
  if (!profile.text.includes("Preferred name") && !profile.text.includes("preferred")) {
    // page title / editor
    if (!profile.text.includes("Profile")) {
      throw new Error("Profile page missing");
    }
  }

  // Profile update via DB (server action hard to call without RSC payload)
  await prisma.studentProfile.update({
    where: { userId: student.id },
    data: { preferredName: "UpdatedHttp", avatarId: "rocket" },
  });
  const desk2 = await fetchFollow(`${BASE}/portal`, {}, sJar);
  if (!desk2.text.includes("UpdatedHttp")) {
    throw new Error("Preferred name not reflecting on My Desk after DB update");
  }

  await prisma.$disconnect();
  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        teacherEmail: TEACHER_EMAIL,
        teacherPassword: TEACHER_PASSWORD,
        studentEmail,
        studentPassword,
        classId: klass.id,
        checks: [
          "middleware redirects unauth",
          "teacher credentials login",
          "teacher dashboard",
          "student credentials login",
          "student My Desk lesson+file",
          "profile preferredName persists",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
