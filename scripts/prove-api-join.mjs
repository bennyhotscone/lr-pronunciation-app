/**
 * Prove POST /api/portal/join with a real student session.
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
  return cookies;
}

async function main() {
  const prisma = new PrismaClient();
  const klass = await prisma.class.findFirst({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!klass) throw new Error("no class");

  const stamp = Date.now();
  const email = `api.join+${stamp}@lrmastery.guru`;
  const password = `ApiJoin${stamp.toString(36)}!x`;
  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "STUDENT",
      profile: {
        create: { fullName: "API Join", preferredName: "API", avatarId: "fox" },
      },
    },
  });

  const cookies = await login(email, password);
  const res = await fetch(`${BASE}/api/portal/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
    },
    body: JSON.stringify({ code: klass.inviteCode }),
  });
  const body = await res.json().catch(() => ({}));
  const mem = await prisma.classMembership.findFirst({
    where: { classId: klass.id, student: { email } },
  });

  const ok = res.status === 200 && body.ok && body.classId === klass.id && mem?.status === "ACTIVE";
  console.log(JSON.stringify({ ok, status: res.status, body, membership: mem?.status, code: klass.inviteCode }, null, 2));
  await prisma.$disconnect();
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
