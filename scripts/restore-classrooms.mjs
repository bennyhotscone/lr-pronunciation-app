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
    let inviteCode = code();
    for (let i = 0; i < 12; i++) {
      const clash = await prisma.class.findUnique({ where: { inviteCode } });
      if (!clash) break;
      inviteCode = code();
    }
    const c = await prisma.class.create({
      data: { name, inviteCode, teacherId: teacher.id },
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
