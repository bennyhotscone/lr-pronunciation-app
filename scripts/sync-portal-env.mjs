import { readFileSync, writeFileSync } from "fs";

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

const env = parseEnv(readFileSync(".env", "utf8"));
const localRaw = readFileSync(".env.local", "utf8");
const local = parseEnv(localRaw);

function host(url) {
  try {
    return new URL(url.replace(/^postgres:/, "postgresql:")).host;
  } catch {
    return "invalid";
  }
}

console.log(".env DATABASE host:", host(env.DATABASE_URL || ""));
console.log(".env.local DATABASE host:", host(local.DATABASE_URL || ""));
console.log(".env CLAIM_URL:", env.CLAIM_URL || "(none)");

// Keep Blob + Mandarin secrets from .env.local; refresh DB/Auth from .env
const keysFromEnv = ["DATABASE_URL", "AUTH_SECRET", "AUTH_TRUST_HOST"];
let next = localRaw;
for (const key of keysFromEnv) {
  if (!env[key]) continue;
  const line = `${key}="${env[key]}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(next)) next = next.replace(re, line);
  else next = next.trimEnd() + `\n${line}\n`;
}
writeFileSync(".env.local", next.endsWith("\n") ? next : next + "\n");
console.log("synced DATABASE_URL/AUTH_* into .env.local");
console.log("after sync host:", host(parseEnv(next).DATABASE_URL || ""));
