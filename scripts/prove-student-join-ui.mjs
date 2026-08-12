/**
 * Full student join via portal form path: login → enroll via Prisma (same as action) → hit classroom page.
 * Also exercises HTML of /portal/join and invite code match for Rita's class.
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

async function login(email, password) {
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
      callbackUrl: `${BASE}/portal`,
      json: "true",
    }),
    redirect: "manual",
  });
  cookies = cookieJar(loginRes, cookies);
  const session = await (
    await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookies } })
  ).json();
  return { cookies, session };
}

async function main() {
  const prisma = new PrismaClient();
  const klass = await prisma.class.findFirst({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!klass) throw new Error("No classroom");

  const stamp = Date.now();
  const email = `student.join+${stamp}@lrmastery.guru`;
  const password = `StudentJoin${stamp.toString(36)}!`;
  const student = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "STUDENT",
      profile: {
        create: { fullName: "Join Tester", preferredName: "JT", avatarId: "fox" },
      },
    },
  });

  const { cookies, session } = await login(email, password);

  // Simulate what JoinCodeForm does: call enroll in DB, then hit pages student would land on
  await prisma.classMembership.upsert({
    where: {
      classId_studentId: { classId: klass.id, studentId: student.id },
    },
    create: { classId: klass.id, studentId: student.id, status: "ACTIVE" },
    update: { status: "ACTIVE", leftAt: null },
  });

  const joinPage = await fetch(`${BASE}/portal/join`, {
    headers: { Cookie: cookies },
    redirect: "manual",
  });
  const joinHtml = await joinPage.text();

  const classPage = await fetch(`${BASE}/portal/classrooms/${klass.id}`, {
    headers: { Cookie: cookies },
    redirect: "manual",
  });

  const desk = await fetch(`${BASE}/portal`, {
    headers: { Cookie: cookies },
    redirect: "manual",
  });
  const deskHtml = await desk.text();

  // Also try invite link join with a SECOND fresh student (no prior membership)
  const email2 = `student.join2+${stamp}@lrmastery.guru`;
  const password2 = password;
  await prisma.user.create({
    data: {
      email: email2,
      passwordHash: await bcrypt.hash(password2, 10),
      role: "STUDENT",
      profile: {
        create: { fullName: "Join2", preferredName: "J2", avatarId: "fox" },
      },
    },
  });
  const s2 = await login(email2, password2);
  const inviteHit = await fetch(`${BASE}/join/${klass.inviteCode}`, {
    headers: { Cookie: s2.cookies },
    redirect: "manual",
  });

  // Check membership count after inviteHit
  const mem2 = await prisma.classMembership.findFirst({
    where: { classId: klass.id, student: { email: email2 } },
  });

  console.log(
    JSON.stringify(
      {
        classroom: { name: klass.name, code: klass.inviteCode, id: klass.id },
        sessionRole: session?.user?.role,
        portalJoin: { status: joinPage.status, hasForm: /Invite code|Join classroom/i.test(joinHtml) },
        classroomPage: {
          status: classPage.status,
          location: classPage.headers.get("location"),
          redirectsToDesk:
            (classPage.status === 307 ||
              classPage.status === 302 ||
              classPage.status === 303) &&
            ((classPage.headers.get("location") || "").replace(/\/$/, "").endsWith("/portal") ||
              (classPage.headers.get("location") || "").includes("/portal?")),
        },
        desk: {
          status: desk.status,
          listsClass: deskHtml.includes(klass.name),
          hasClassBoard: /Class board|Stream|Organiser/i.test(deskHtml),
        },
        inviteLinkSecondStudent: {
          status: inviteHit.status,
          location: inviteHit.headers.get("location"),
          membership: mem2?.status ?? null,
        },
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
