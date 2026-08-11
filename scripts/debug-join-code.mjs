/**
 * Debug production /join/[code] for logged-in student.
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

async function main() {
  const prisma = new PrismaClient();
  const klass = await prisma.class.findFirst({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!klass) throw new Error("no class");

  const email = `join.debug+${Date.now()}@lrmastery.guru`;
  const pass = "DebugJoin2026!xx";
  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(pass, 10),
      role: "STUDENT",
      profile: { create: { fullName: "D", preferredName: "D", avatarId: "fox" } },
    },
  });

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
      password: pass,
      callbackUrl: `${BASE}/portal`,
      json: "true",
    }),
    redirect: "manual",
  });
  cookies = cookieJar(loginRes, cookies);

  const url = `${BASE}/join/${klass.inviteCode}`;
  const res = await fetch(url, { headers: { Cookie: cookies }, redirect: "manual" });
  const text = await res.text();
  console.log(
    JSON.stringify(
      {
        status: res.status,
        location: res.headers.get("location"),
        invite: klass.inviteCode,
        digest: (text.match(/digest["' ]*[:=]["' ]*([a-z0-9]+)/i) || [])[1] || null,
        snippet: text.replace(/\s+/g, " ").slice(0, 2000),
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
