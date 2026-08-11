import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { spawnSync } from "child_process";
import { tmpdir } from "os";
import path from "path";

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

const env = {
  ...parseEnv(readFileSync(".env", "utf8")),
  ...parseEnv(readFileSync(".env.local", "utf8")),
};

const pairs = {
  DATABASE_URL: env.DATABASE_URL,
  AUTH_SECRET: env.AUTH_SECRET,
  AUTH_TRUST_HOST: env.AUTH_TRUST_HOST || "true",
};

for (const [key, value] of Object.entries(pairs)) {
  if (!value) {
    console.error(`Missing ${key}`);
    process.exit(1);
  }
  spawnSync("npx", ["vercel", "env", "rm", key, "production", "--yes"], {
    stdio: "inherit",
    shell: true,
  });
  const r = spawnSync(
    "npx",
    ["vercel", "env", "add", key, "production", "--value", value, "--yes"],
    { stdio: "inherit", shell: true },
  );
  if (r.status !== 0) {
    console.error(`Failed to set ${key}`);
    process.exit(r.status || 1);
  }
  console.log(`Set ${key} for production`);
}

console.log("BLOB_READ_WRITE_TOKEN present locally:", Boolean(env.BLOB_READ_WRITE_TOKEN));
