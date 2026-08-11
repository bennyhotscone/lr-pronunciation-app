/**
 * Prove production teach-today path: login CSRF, signup page, student create+login.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";

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

async function credentialsLogin(email, password) {
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
      callbackUrl: `${BASE}/teacher`,
      json: "true",
    }),
    redirect: "manual",
  });
  cookies = cookieJar(loginRes, cookies);
  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: cookies },
  });
  const session = await sessionRes.json();
  const teacherPage = await fetch(`${BASE}/teacher`, {
    headers: { Cookie: cookies },
    redirect: "manual",
  });
  return {
    loginStatus: loginRes.status,
    role: session?.user?.role ?? null,
    email: session?.user?.email ?? null,
    teacherStatus: teacherPage.status,
    teacherOk: teacherPage.status === 200,
    session,
  };
}

async function main() {
  const loginHtml = await (await fetch(`${BASE}/login`)).text();
  const signupHtml = await (await fetch(`${BASE}/signup`)).text();
  const loginPage = {
    hasSignUp: /Sign up/i.test(loginHtml) && /\/signup/.test(loginHtml),
    hasForgot: /forgot-password/i.test(loginHtml),
  };
  const signupPage = {
    ok: /Create student account|Create your account/i.test(signupHtml),
  };

  // Seed teacher login
  const teacherLogin = await credentialsLogin(
    "teacher@lrmastery.guru",
    "TeacherTemp2026!",
  );

  // Student via DB (same as signup role) + login
  const stamp = Date.now();
  const studentEmail = `today.student+${stamp}@lrmastery.guru`;
  const studentPass = `Today${stamp.toString(36)}!xx`;
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash(studentPass, 10);
  await prisma.user.create({
    data: {
      email: studentEmail,
      passwordHash: hash,
      role: "STUDENT",
      profile: {
        create: {
          fullName: "Today Student",
          preferredName: "Today",
          avatarId: "fox",
        },
      },
    },
  });
  await prisma.$disconnect();

  const studentLogin = await credentialsLogin(studentEmail, studentPass);
  // student landing should be /portal not teacher for STUDENT
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
      email: studentEmail,
      password: studentPass,
      callbackUrl: `${BASE}/portal`,
      json: "true",
    }),
    redirect: "manual",
  });
  cookies = cookieJar(loginRes, cookies);
  const portalRes = await fetch(`${BASE}/portal`, {
    headers: { Cookie: cookies },
    redirect: "manual",
  });

  const report = {
    base: BASE,
    loginPage,
    signupPage,
    teacherLogin: {
      role: teacherLogin.role,
      email: teacherLogin.email,
      teacherDashOk: teacherLogin.teacherOk,
      teacherStatus: teacherLogin.teacherStatus,
    },
    student: {
      email: studentEmail,
      role: studentLogin.role,
      portalStatus: portalRes.status,
      portalOk: portalRes.status === 200,
    },
  };
  console.log(JSON.stringify(report, null, 2));

  const ok =
    loginPage.hasSignUp &&
    signupPage.ok &&
    teacherLogin.role === "ADMIN" &&
    teacherLogin.teacherOk &&
    studentLogin.role === "STUDENT" &&
    portalRes.status === 200;
  console.log(ok ? "TEACH_TODAY_OK" : "TEACH_TODAY_FAIL");
  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
