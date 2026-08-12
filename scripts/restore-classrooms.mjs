import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

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

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function code() {
  let s = "";
  for (let i = 0; i < 6; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

/** Known production classroom — prefer stable id + invite when restoring Rita's class. */
const KNOWN = {
  "rita's class": {
    id: "cmso22jkg0001s1a0mozrffu7",
    inviteCode: "7GHW4L",
    name: "Rita's class",
  },
};

const prisma = new PrismaClient();
const names = process.argv.slice(2);
if (!names.length) {
  console.log("Usage: node scripts/restore-classrooms.mjs \"Rita's class\" Rita");
  process.exit(1);
}

async function main() {
  const teacher = await prisma.user.findUnique({
    where: { email: "teacher@lrmastery.guru" },
  });
  if (!teacher) throw new Error("teacher missing");

  for (const name of names) {
    const known = KNOWN[name.trim().toLowerCase()];
    const displayName = known?.name || name;

    const existing =
      (known &&
        (await prisma.class.findUnique({ where: { id: known.id } }))) ||
      (known &&
        (await prisma.class.findUnique({
          where: { inviteCode: known.inviteCode },
        }))) ||
      (await prisma.class.findFirst({
        where: {
          name: { equals: displayName, mode: "insensitive" },
          teacherId: teacher.id,
          archivedAt: null,
        },
      }));

    if (existing) {
      const c = await prisma.class.update({
        where: { id: existing.id },
        data: {
          teacherId: teacher.id,
          archivedAt: null,
          name: displayName,
          inviteCode: known?.inviteCode || existing.inviteCode,
        },
      });
      console.log(`Already present / refreshed: ${c.name} · code ${c.inviteCode}`);
      continue;
    }

    let inviteCode = known?.inviteCode || code();
    if (!known) {
      for (let i = 0; i < 12; i++) {
        const clash = await prisma.class.findUnique({ where: { inviteCode } });
        if (!clash) break;
        inviteCode = code();
      }
    }

    const c = await prisma.class.create({
      data: {
        ...(known?.id ? { id: known.id } : {}),
        name: displayName,
        inviteCode,
        teacherId: teacher.id,
        description: known ? "Rita's classroom" : undefined,
      },
    });
    console.log(`Restored: ${c.name} · code ${c.inviteCode}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
