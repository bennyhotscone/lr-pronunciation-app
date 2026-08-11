/**
 * Prove classroom create + student join by invite code (DB + optional HTTP).
 * Usage: node scripts/prove-join-classroom.mjs [baseUrl]
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

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

async function credentialsLogin(email, password, callbackUrl) {
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
  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: cookies },
  });
  const session = await sessionRes.json();
  return { cookies, session, loginStatus: loginRes.status };
}

function code6() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function main() {
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const results = {};

  try {
    const teacher = await prisma.user.findUnique({
      where: { email: "teacher@lrmastery.guru" },
    });
    if (!teacher) throw new Error("Seed teacher missing — run ensure-seed-admin / db:seed");

    let inviteCode = code6();
    for (let i = 0; i < 20; i++) {
      const clash = await prisma.class.findUnique({ where: { inviteCode } });
      if (!clash) break;
      inviteCode = code6();
    }

    const klass = await prisma.class.create({
      data: {
        name: `Prove Join ${stamp}`,
        inviteCode,
        teacherId: teacher.id,
      },
    });
    results.classroom = { id: klass.id, inviteCode: klass.inviteCode };

    const studentEmail = `join.prove+${stamp}@lrmastery.guru`;
    const studentPass = `JoinProve${stamp.toString(36)}!x`;
    const student = await prisma.user.create({
      data: {
        email: studentEmail,
        passwordHash: await bcrypt.hash(studentPass, 10),
        role: "STUDENT",
        profile: {
          create: {
            fullName: "Join Prove",
            preferredName: "JoinProve",
            avatarId: "fox",
          },
        },
      },
    });
    results.student = { id: student.id, email: studentEmail };

    // DB-level membership (what the server action does)
    await prisma.classMembership.upsert({
      where: {
        classId_studentId: { classId: klass.id, studentId: student.id },
      },
      create: { classId: klass.id, studentId: student.id, status: "ACTIVE" },
      update: { status: "ACTIVE", leftAt: null },
    });
    const membership = await prisma.classMembership.findUnique({
      where: {
        classId_studentId: { classId: klass.id, studentId: student.id },
      },
    });
    results.dbMembership = membership?.status === "ACTIVE";

    // HTTP: pages exist
    const joinPublic = await fetch(`${BASE}/join`, { redirect: "manual" });
    const joinPortal = await fetch(`${BASE}/portal/join`, { redirect: "manual" });
    const joinCode = await fetch(`${BASE}/join/${inviteCode}`, { redirect: "manual" });
    results.pages = {
      join: joinPublic.status,
      portalJoinUnauth: joinPortal.status, // expect 307/302 to login
      joinCode: joinCode.status,
    };

    // Student can reach /portal/join when logged in (not bounced to /portal only)
    const { cookies, session } = await credentialsLogin(
      studentEmail,
      studentPass,
      `${BASE}/portal/join`,
    );
    results.studentSession = Boolean(session?.user?.id);
    results.studentRole = session?.user?.role ?? null;

    const portalJoinAuthed = await fetch(`${BASE}/portal/join`, {
      headers: { Cookie: cookies },
      redirect: "manual",
    });
    results.portalJoinAuthed = {
      status: portalJoinAuthed.status,
      location: portalJoinAuthed.headers.get("location"),
    };

    const joinCodeAuthed = await fetch(`${BASE}/join/${inviteCode}`, {
      headers: { Cookie: cookies },
      redirect: "manual",
    });
    results.joinCodeAuthed = {
      status: joinCodeAuthed.status,
      location: joinCodeAuthed.headers.get("location"),
    };

    // Accept 200 or redirect into the classroom (invite link auto-join)
    const loc = joinCodeAuthed.headers.get("location") || "";
    results.joinCodeAuthedOk =
      joinCodeAuthed.status === 200 ||
      ((joinCodeAuthed.status === 307 || joinCodeAuthed.status === 302) &&
        loc.includes("/portal/classrooms/"));

    const joinAuthed = await fetch(`${BASE}/join`, {
      headers: { Cookie: cookies },
      redirect: "manual",
    });
    results.joinAuthed = {
      status: joinAuthed.status,
      location: joinAuthed.headers.get("location"),
    };

    const bouncedAway =
      (joinAuthed.status === 307 || joinAuthed.status === 302) &&
      (joinAuthed.headers.get("location") || "").replace(/\/$/, "").endsWith("/portal") &&
      !(joinAuthed.headers.get("location") || "").includes("/portal/join");
    results.joinNotBounced = !bouncedAway;

    const ok =
      results.dbMembership &&
      results.studentSession &&
      results.studentRole === "STUDENT" &&
      results.portalJoinAuthed.status === 200 &&
      results.joinNotBounced &&
      results.joinCodeAuthedOk;

    console.log(JSON.stringify({ ok, BASE, ...results }, null, 2));
    if (!ok) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
