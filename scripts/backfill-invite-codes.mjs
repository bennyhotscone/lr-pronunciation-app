import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function code(n = 6) {
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function main() {
  const classes = await prisma.class.findMany({
    where: { OR: [{ inviteCode: null }, { inviteCode: "" }] },
  });
  for (const c of classes) {
    let inviteCode = code(6);
    for (let i = 0; i < 20; i++) {
      const clash = await prisma.class.findUnique({ where: { inviteCode } });
      if (!clash) break;
      inviteCode = code(6);
    }
    await prisma.class.update({ where: { id: c.id }, data: { inviteCode } });
    console.log("backfilled", c.id, inviteCode);
  }
  const nulls = await prisma.class.count({ where: { inviteCode: null } });
  console.log("remaining null", nulls);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
