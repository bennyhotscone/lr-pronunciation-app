import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Always cache — Vercel serverless reuses isolates; recreating clients leaves
// dead sockets that surface as "Connection closed" on the next request.
globalForPrisma.prisma = prisma;

export function isPrismaConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  return (
    /Connection closed|Can't reach database server|Connection reset|Server has closed the connection|Timed out fetching a new connection|P1001|P1002|P1017/i.test(
      msg,
    ) ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1017"
  );
}

/** Run a Prisma operation; on transient connection death, reconnect and retry once. */
export async function withPrismaRetry<T>(
  fn: (db: PrismaClient) => Promise<T>,
  attempts = 2,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    const db = globalForPrisma.prisma ?? createPrismaClient();
    globalForPrisma.prisma = db;
    try {
      return await fn(db);
    } catch (err) {
      last = err;
      if (!isPrismaConnectionError(err) || i === attempts - 1) throw err;
      console.warn("[db] connection error; reconnecting once", err);
      try {
        await db.$disconnect();
      } catch {
        /* ignore */
      }
      globalForPrisma.prisma = createPrismaClient();
    }
  }
  throw last;
}
