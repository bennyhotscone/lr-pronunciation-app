/**
 * Brutal honesty audit: what classrooms/memberships/students exist right now,
 * and whether join API + classroom + desk work for a brand-new student using the
 * real invite code from Rita's class.
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
  return { cookies, session, loginStatus: loginRes.status };
}

const prisma = new PrismaClient();

async function main() {
  const classes = await prisma.class.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: { select: { email: true, role: true } },
      memberships: {
        where: { status: "ACTIVE" },
        include: {
          student: {
            select: {
              email: true,
              role: true,
              profile: { select: { preferredName: true, fullName: true } },
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const recentStudents = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      profile: { select: { preferredName: true, fullName: true } },
      memberships: {
        where: { status: "ACTIVE" },
        include: { class: { select: { name: true, inviteCode: true } } },
      },
    },
  });

  console.log("=== CLASSROOMS ===");
  for (const c of classes) {
    console.log(
      `\n${c.name} | code=${c.inviteCode} | id=${c.id} | teacher=${c.teacher.email}`,
    );
    console.log(`  active students (${c.memberships.length}):`);
    for (const m of c.memberships) {
      const label =
        m.student.profile?.preferredName ||
        m.student.profile?.fullName ||
        m.student.email;
      console.log(`   - ${label} <${m.student.email}> joined ${m.joinedAt.toISOString()}`);
    }
  }

  console.log("\n=== RECENT STUDENTS (last 15) ===");
  for (const s of recentStudents) {
    const label = s.profile?.preferredName || s.profile?.fullName || s.email;
    const classesJoined = s.memberships.map((m) => `${m.class.name}(${m.class.inviteCode})`).join(", ") || "(none)";
    console.log(`- ${label} <${s.email}> created ${s.createdAt.toISOString()} → ${classesJoined}`);
  }

  // Live join test against first class invite code via API (what the new form uses)
  const target = classes[0];
  if (!target) {
    console.log("\nNO CLASSROOMS — nothing to join");
    return;
  }

  const stamp = Date.now();
  const email = `brutal+${stamp}@lrmastery.guru`;
  const password = `Brutal${stamp.toString(36)}!xx`;
  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "STUDENT",
      profile: {
        create: { fullName: "Brutal Test", preferredName: "Brutal", avatarId: "fox" },
      },
    },
  });

  const { cookies, session } = await login(email, password);
  const apiRes = await fetch(`${BASE}/api/portal/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify({ code: target.inviteCode }),
  });
  const apiBody = await apiRes.json().catch(() => ({}));

  const classPage = apiBody.classId
    ? await fetch(`${BASE}/portal/classrooms/${apiBody.classId}`, {
        headers: { Cookie: cookies },
        redirect: "manual",
      })
    : null;
  const desk = await fetch(`${BASE}/portal`, {
    headers: { Cookie: cookies },
    redirect: "manual",
  });
  const deskHtml = await desk.text();

  // Wrong-code control
  const bad = await fetch(`${BASE}/api/portal/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify({ code: "ZZZZZZ" }),
  });
  const badBody = await bad.json().catch(() => ({}));

  // Staff trying to join
  const staff = await login("teacher@lrmastery.guru", "TeacherTemp2026!");
  const staffJoin = await fetch(`${BASE}/api/portal/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: staff.cookies },
    body: JSON.stringify({ code: target.inviteCode }),
  });
  const staffBody = await staffJoin.json().catch(() => ({}));

  console.log("\n=== LIVE JOIN PROOF ===");
  console.log(
    JSON.stringify(
      {
        targetClass: { name: target.name, code: target.inviteCode },
        newStudent: { email, role: session?.user?.role },
        apiJoin: { status: apiRes.status, body: apiBody },
        classroomPage: classPage
          ? { status: classPage.status, location: classPage.headers.get("location") }
          : null,
        deskListsClass: deskHtml.includes(target.name),
        wrongCode: { status: bad.status, body: badBody },
        staffBlocked: { status: staffJoin.status, body: staffBody },
      },
      null,
      2,
    ),
  );

  // Check if invite page HTML still ships JoinCodeForm that posts to API
  const joinHtml = await (await fetch(`${BASE}/portal/join` , { headers: { Cookie: cookies }})).text();
  console.log("\n=== JOIN PAGE WIRED TO API? ===");
  console.log({
    mentionsApi: joinHtml.includes("/api/portal/join") || joinHtml.includes("api/portal/join"),
    // client bundle may not inline the string in HTML — check form presence
    hasInviteInput: /name=\"code\"|Invite code/i.test(joinHtml),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
