/**
 * Provision a fresh temporary Prisma Postgres (npx create-db), wire env files,
 * push schema, seed teacher admin, and optionally sync Vercel production.
 *
 * Usage:
 *   node scripts/provision-prisma-db.mjs
 *   node scripts/provision-prisma-db.mjs --vercel
 *   node scripts/provision-prisma-db.mjs --region ap-southeast-1 --vercel
 *
 * Does NOT require the browser claim loop. Trial DBs expire after ~24h;
 * re-run this script (or let an agent) before expiry. Permanent marketplace
 * Postgres needs one interactive Vercel terms accept — not create-db claim.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";

function parseArgs(argv) {
  const out = { vercel: false, region: "ap-southeast-1", ttl: "24h" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--vercel") out.vercel = true;
    else if (a === "--region") out.region = argv[++i];
    else if (a === "--ttl") out.ttl = argv[++i];
  }
  return out;
}

function parseEnv(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
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
    out[key] = val;
  }
  return out;
}

function upsertEnvFile(path, pairs) {
  let raw = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const [key, value] of Object.entries(pairs)) {
    if (value == null || value === "") continue;
    const line = `${key}="${value}"`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(raw)) raw = raw.replace(re, line);
    else raw = (raw.trimEnd() ? raw.trimEnd() + "\n" : "") + line + "\n";
  }
  writeFileSync(path, raw.endsWith("\n") ? raw : raw + "\n");
}

function hostOf(url) {
  try {
    return new URL(url.replace(/^postgres:/, "postgresql:")).host;
  } catch {
    return "invalid";
  }
}

const opts = parseArgs(process.argv);

console.log("Creating Prisma Postgres via create-db…", opts);
const created = spawnSync(
  "npx",
  [
    "create-db@latest",
    "create",
    "--json",
    "--region",
    opts.region,
    "--ttl",
    opts.ttl,
  ],
  { encoding: "utf8", shell: true },
);

if (created.status !== 0) {
  console.error(created.stderr || created.stdout || "create-db failed");
  process.exit(created.status || 1);
}

let payload;
try {
  payload = JSON.parse(created.stdout.trim());
} catch {
  console.error("create-db did not return JSON:\n", created.stdout);
  process.exit(1);
}

if (!payload?.success || !payload.connectionString) {
  console.error("create-db failed:", payload);
  process.exit(1);
}

const DATABASE_URL = payload.connectionString;
const CLAIM_URL = payload.claimUrl || "";
const DB_EXPIRES_AT = payload.deletionDate || "";

const pairs = { DATABASE_URL, CLAIM_URL, DB_EXPIRES_AT };
upsertEnvFile(".env", pairs);
upsertEnvFile(".env.local", pairs);

console.log("Wrote DATABASE_URL to .env and .env.local");
console.log("host:", hostOf(DATABASE_URL));
console.log("expires:", DB_EXPIRES_AT || "(unknown)");
console.log(
  "note: browser claim is unreliable; agents re-run this script before expiry",
);

process.env.DATABASE_URL = DATABASE_URL;

const push = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
if (push.status !== 0) process.exit(push.status || 1);

const seed = spawnSync("node", ["scripts/ensure-seed-admin.mjs"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
if (seed.status !== 0) process.exit(seed.status || 1);

if (opts.vercel) {
  const sync = spawnSync("node", ["scripts/set-vercel-portal-env.mjs"], {
    stdio: "inherit",
    shell: true,
  });
  if (sync.status !== 0) process.exit(sync.status || 1);
  const deploy = spawnSync("npx", ["vercel", "--prod", "--yes"], {
    stdio: "inherit",
    shell: true,
  });
  if (deploy.status !== 0) process.exit(deploy.status || 1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      host: hostOf(DATABASE_URL),
      expires: DB_EXPIRES_AT,
      vercel: opts.vercel,
      teacher: "teacher@lrmastery.guru",
    },
    null,
    2,
  ),
);
