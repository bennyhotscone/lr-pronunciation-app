import { readFileSync, writeFileSync } from "fs";

function loadEnv() {
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
    process.env[key] = val;
  }
}

loadEnv();

const BASE = process.env.BASE_URL || "http://localhost:3000";

function jarFrom(res, jar) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const part = c.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return jar;
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(email, password) {
  const jar = new Map();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { cookie: cookieHeader(jar) },
  });
  jarFrom(csrfRes, jar);
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/teacher`,
    json: "true",
  });

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(jar),
    },
    body,
    redirect: "manual",
  });
  jarFrom(loginRes, jar);

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: cookieHeader(jar) },
  });
  jarFrom(sessionRes, jar);
  const session = await sessionRes.json();
  return { jar, session, loginStatus: loginRes.status };
}

async function get(path, jar) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  const text = await res.text();
  return { status: res.status, location: res.headers.get("location"), len: text.length, snippet: text.slice(0, 200) };
}

async function main() {
  const teacher = await login("teacher@lrmastery.guru", "TeacherTemp2026!");
  const teacherDash = await get("/teacher", teacher.jar);
  const studentCreds = JSON.parse(
    readFileSync("scripts/.last-e2e-student.json", "utf8"),
  ).catch
    ? null
    : null;

  let studentEmail = process.env.STUDENT_EMAIL;
  let studentPassword = process.env.STUDENT_PASSWORD || "StudentTemp2026!";
  try {
    const last = JSON.parse(readFileSync("scripts/.last-e2e-student.json", "utf8"));
    studentEmail = last.studentEmail;
    studentPassword = last.studentPassword;
  } catch {
    /* use env or skip */
  }

  const out = {
    teacherSession: teacher.session?.user
      ? { email: teacher.session.user.email, role: teacher.session.user.role }
      : teacher.session,
    teacherDash: { status: teacherDash.status, location: teacherDash.location },
  };

  if (studentEmail) {
    const student = await login(studentEmail, studentPassword);
    const desk = await get("/portal", student.jar);
    out.studentSession = student.session?.user
      ? { email: student.session.user.email, role: student.session.user.role }
      : student.session;
    out.desk = {
      status: desk.status,
      hasWorksheet: desk.snippet.includes("Worksheet") || undefined,
      location: desk.location,
      // fetch full for content check
    };
    const deskFull = await fetch(`${BASE}/portal`, {
      headers: { cookie: cookieHeader(student.jar) },
    });
    const html = await deskFull.text();
    out.desk.status = deskFull.status;
    out.desk.hasWorksheet = html.includes("Worksheet PDF");
    out.desk.hasJustForYou = html.includes("Personal tip sheet");
    out.desk.hasWelcome = html.includes("Welcome back");
    out.desk.hasLesson = html.includes("Week 1 Sounds");
  }

  console.log(JSON.stringify(out, null, 2));
  writeFileSync("scripts/.last-auth-check.json", JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
