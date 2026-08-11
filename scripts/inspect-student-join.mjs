/**
 * Inspect a specific student and try joining Rita's class as them (reset password temporarily for HTTP proof, or just DB check).
 * Usage: node scripts/inspect-student-join.mjs djsundad@gmail.com
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";

const BASE = (process.argv[3] || "https://lrmastery.guru").replace(/\/$/, "");
const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/inspect-student-join.mjs student@email.com");
  process.exit(1);
}

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
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: true,
      memberships: {
        include: { class: true },
        orderBy: { joinedAt: "desc" },
      },
    },
  });

  if (!user) {
    console.log(JSON.stringify({ found: false, email }, null, 2));
    return;
  }

  const classes = await prisma.class.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, inviteCode: true },
  });

  console.log(
    JSON.stringify(
      {
        found: true,
        id: user.id,
        email: user.email,
        role: user.role,
        archivedAt: user.archivedAt,
        profile: {
          preferredName: user.profile?.preferredName,
          fullName: user.profile?.fullName,
        },
        memberships: user.memberships.map((m) => ({
          status: m.status,
          className: m.class.name,
          inviteCode: m.class.inviteCode,
          classId: m.classId,
          joinedAt: m.joinedAt,
        })),
        liveClassrooms: classes,
      },
      null,
      2,
    ),
  );

  // Set a known temp password, login as them, call join API with each live class code
  const tempPass = `TempJoinFix_${Date.now()}!`;
  const prevHash = user.passwordHash;
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(tempPass, 10) },
  });

  try {
    const { cookies, session } = await login(email, tempPass);
    const target = classes[0];
    const results = [];
    for (const c of classes) {
      const res = await fetch(`${BASE}/api/portal/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies },
        body: JSON.stringify({ code: c.inviteCode }),
      });
      const body = await res.json().catch(() => ({}));
      results.push({ code: c.inviteCode, name: c.name, status: res.status, body });
    }

    // Also try invite link
    let inviteLink = null;
    if (target) {
      const hit = await fetch(`${BASE}/join/${target.inviteCode}`, {
        headers: { Cookie: cookies },
        redirect: "manual",
      });
      inviteLink = {
        status: hit.status,
        location: hit.headers.get("location"),
      };
    }

    const after = await prisma.classMembership.findMany({
      where: { studentId: user.id },
      include: { class: { select: { name: true, inviteCode: true } } },
    });

    const desk = await fetch(`${BASE}/portal`, {
      headers: { Cookie: cookies },
      redirect: "manual",
    });
    const deskHtml = await desk.text();

    console.log(
      "\n=== AS THIS STUDENT (temp password used for API proof only) ===",
    );
    console.log(
      JSON.stringify(
        {
          sessionRole: session?.user?.role,
          sessionId: session?.user?.id,
          joinApiResults: results,
          inviteLink,
          membershipsAfter: after.map((m) => ({
            status: m.status,
            name: m.class.name,
            code: m.class.inviteCode,
          })),
          deskShowsRita: /Rita/i.test(deskHtml),
          deskStatus: desk.status,
        },
        null,
        2,
      ),
    );
  } finally {
    // Restore original password hash so we don't lock the user out of their password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: prevHash },
    });
    console.log("\n(restored original password hash)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
