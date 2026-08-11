/**
 * List / purge classrooms. Usage:
 *   node scripts/purge-test-classrooms.mjs           # list
 *   node scripts/purge-test-classrooms.mjs --all    # delete ALL classrooms
 *   node scripts/purge-test-classrooms.mjs --test   # delete Prove/join.prove/seed junk only
 */
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

const mode = process.argv.includes("--all")
  ? "all"
  : process.argv.includes("--test")
    ? "test"
    : "list";

function isTestClass(name) {
  return /^(Prove Join|join\.prove|Today |E2E|Test |HTTP |Smoke )/i.test(name) ||
    /prove join/i.test(name);
}

const prisma = new PrismaClient();

async function main() {
  const classes = await prisma.class.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { memberships: true } },
      teacher: { select: { email: true } },
    },
  });

  console.log(
    "Current classrooms:\n" +
      classes
        .map(
          (c) =>
            `- ${c.name} | code ${c.inviteCode} | ${c._count.memberships} students | ${c.teacher.email} | ${c.createdAt.toISOString()} | ${isTestClass(c.name) ? "TEST" : "maybe-real"}`,
        )
        .join("\n"),
  );

  if (mode === "list") {
    console.log("\nRe-run with --all to delete every classroom, or --test for Prove/test junk only.");
    return;
  }

  const targets =
    mode === "all" ? classes : classes.filter((c) => isTestClass(c.name));

  if (!targets.length) {
    console.log("Nothing to delete.");
    return;
  }

  const ids = targets.map((c) => c.id);
  // Cascades handle memberships/posts/etc where configured
  const result = await prisma.class.deleteMany({ where: { id: { in: ids } } });
  console.log(`\nDeleted ${result.count} classroom(s):`);
  for (const c of targets) console.log(` - ${c.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
