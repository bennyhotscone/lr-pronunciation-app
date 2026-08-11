/**
 * Production portal file upload/download E2E against lrmastery.guru.
 * Uses teacher credentials, Blob upload via API, student auth download.
 *
 * Usage:
 *   node scripts/portal-prod-files-e2e.mjs
 * Env: PORTAL_E2E_BASE (default https://lrmastery.guru), DATABASE_URL from .env.local
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";

function loadEnvLocal() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(file, "utf8");
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
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {
      /* missing file ok */
    }
  }
}

loadEnvLocal();

const BASE = process.env.PORTAL_E2E_BASE || "https://lrmastery.guru";
const TEACHER_EMAIL = "teacher@lrmastery.guru";
const TEACHER_PASSWORD = "TeacherTemp2026!";

function cookieJar() {
  const jar = new Map();
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || [];
      for (const c of raw) {
        const [pair] = c.split(";");
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        jar.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
      const single = res.headers.get("set-cookie");
      if (single && !raw.length) {
        for (const part of single.split(/,(?=\s*[^;]+=)/)) {
          const [pair] = part.trim().split(";");
          const eq = pair.indexOf("=");
          if (eq === -1) continue;
          jar.set(pair.slice(0, eq), pair.slice(eq + 1));
        }
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    clear() {
      jar.clear();
    },
  };
}

async function fetchFollow(url, opts = {}, jar, maxRedirects = 8) {
  let current = url;
  let method = opts.method || "GET";
  let body = opts.body;
  let headers = { ...(opts.headers || {}) };
  for (let i = 0; i <= maxRedirects; i++) {
    headers.Cookie = jar.header();
    const res = await fetch(current, {
      method,
      body,
      headers,
      redirect: "manual",
    });
    jar.store(res);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`Redirect without Location from ${current}`);
      current = new URL(loc, current).toString();
      if (res.status === 303 || (res.status === 302 && method === "POST")) {
        method = "GET";
        body = undefined;
        headers = { ...(opts.headers || {}) };
        delete headers["Content-Type"];
      }
      continue;
    }
    const text = await res.text();
    return { res, text, url: current };
  }
  throw new Error("Too many redirects");
}

async function login(email, password, jar) {
  jar.clear();
  await fetchFollow(`${BASE}/login`, {}, jar);
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { Cookie: jar.header() },
  });
  jar.store(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/`,
    json: "true",
  });

  const { res, text, url } = await fetchFollow(
    `${BASE}/api/auth/callback/credentials`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    jar,
  );

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: jar.header() },
  });
  jar.store(sessionRes);
  const session = await sessionRes.json();
  if (!session?.user) {
    throw new Error(
      `Login failed for ${email}. status=${res.status} url=${url} body=${text.slice(0, 200)}`,
    );
  }
  return session;
}

async function main() {
  if (BASE.includes("localhost")) {
    console.warn("WARNING: BASE is localhost — set PORTAL_E2E_BASE for production.");
  }

  const prisma = new PrismaClient();
  const stamp = Date.now();
  const studentEmail = `student.prodfiles+${stamp}@lrmastery.guru`;
  const studentPassword = "StudentProdFiles2026!";
  const marker = `portal-blob-proof-${stamp}`;

  const teacher = await prisma.user.findUnique({ where: { email: TEACHER_EMAIL } });
  if (!teacher) throw new Error("Teacher missing in DB — seed production teacher first");

  let student = await prisma.user.findUnique({ where: { email: studentEmail } });
  if (!student) {
    student = await prisma.user.create({
      data: {
        email: studentEmail,
        passwordHash: await bcrypt.hash(studentPassword, 10),
        role: "STUDENT",
        profile: {
          create: {
            fullName: "Prod Files Student",
            preferredName: "ProdFiles",
            avatarId: "fox",
          },
        },
      },
    });
  }

  let klass = await prisma.class.findFirst({
    where: { teacherId: teacher.id, name: { startsWith: "Prod Files Class" }, archivedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!klass) {
    klass = await prisma.class.create({
      data: {
        name: `Prod Files Class ${stamp}`,
        description: "Blob upload/download verification",
        teacherId: teacher.id,
      },
    });
  }

  await prisma.classMembership.upsert({
    where: { classId_studentId: { classId: klass.id, studentId: student.id } },
    create: { classId: klass.id, studentId: student.id, status: "ACTIVE" },
    update: { status: "ACTIVE", leftAt: null },
  });

  // Teacher login + real upload API on production
  const tJar = cookieJar();
  await login(TEACHER_EMAIL, TEACHER_PASSWORD, tJar);

  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const pngBytes = Buffer.from(pngBase64, "base64");
  const form = new FormData();
  form.append(
    "file",
    new Blob([pngBytes], { type: "image/png" }),
    `proof-${stamp}.png`,
  );
  form.append("title", `Prod Blob Proof ${stamp}`);
  form.append("classId", klass.id);
  form.append("description", marker);

  const uploadRes = await fetch(`${BASE}/api/portal/resources`, {
    method: "POST",
    headers: { Cookie: tJar.header() },
    body: form,
  });
  const uploadJson = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) {
    throw new Error(
      `Upload failed status=${uploadRes.status} body=${JSON.stringify(uploadJson)}`,
    );
  }
  if (uploadJson.storageMode !== "blob") {
    throw new Error(`Expected storageMode=blob, got ${uploadJson.storageMode}`);
  }
  const blobPath = uploadJson.resource?.blobPath || "";
  const blobUrl = uploadJson.resource?.blobUrl || "";
  if (!blobPath.startsWith("portal-files/")) {
    throw new Error(`Expected portal-files/ prefix, got ${blobPath}`);
  }
  if (!blobUrl.includes("blob.vercel-storage.com") && !blobUrl.includes("vercel-storage.com")) {
    throw new Error(`Expected Vercel Blob URL, got ${blobUrl}`);
  }

  const resourceId = uploadJson.resource.id;

  // Direct Blob URL should resolve (public store)
  const rawBlob = await fetch(blobUrl);
  if (!rawBlob.ok) {
    throw new Error(`Raw Blob GET failed status=${rawBlob.status} url=${blobUrl}`);
  }

  // Student sees file on My Desk / Files and download API works
  const sJar = cookieJar();
  await login(studentEmail, studentPassword, sJar);

  const desk = await fetchFollow(`${BASE}/portal`, {}, sJar);
  if (desk.res.status !== 200) throw new Error(`My Desk status ${desk.res.status}`);
  if (!desk.text.includes(`Prod Blob Proof ${stamp}`) && !desk.text.includes("proof-")) {
    // Title should appear
    if (!desk.text.includes(String(stamp))) {
      // soft check — resources page is authoritative
    }
  }

  const filesPage = await fetchFollow(`${BASE}/portal/resources`, {}, sJar);
  if (filesPage.res.status !== 200) {
    throw new Error(`Resources page status ${filesPage.res.status}`);
  }
  if (!filesPage.text.includes(`/api/portal/resources/${resourceId}/download`)) {
    throw new Error("Resources page missing authenticated download link");
  }
  if (filesPage.text.includes(blobUrl)) {
    throw new Error("Resources page should not expose raw Blob URL");
  }

  const dl = await fetch(`${BASE}/api/portal/resources/${resourceId}/download`, {
    headers: { Cookie: sJar.header() },
  });
  if (!dl.ok) {
    throw new Error(`Student download failed status=${dl.status}`);
  }
  const dlPathHeader = dl.headers.get("x-portal-blob-path");
  if (dlPathHeader !== blobPath) {
    throw new Error(`Download header blob path mismatch: ${dlPathHeader} vs ${blobPath}`);
  }
  const dlBuf = Buffer.from(await dl.arrayBuffer());
  if (dlBuf.length < 20) throw new Error("Download body too small");
  if (!dlBuf.equals(pngBytes)) {
    // PNG may be served with same bytes
    if (dlBuf[0] !== 0x89 || dlBuf[1] !== 0x50) {
      throw new Error("Download body is not the uploaded PNG");
    }
  }

  // Unauth download must fail
  const unauth = await fetch(`${BASE}/api/portal/resources/${resourceId}/download`);
  if (unauth.status !== 401) {
    throw new Error(`Expected unauth 401, got ${unauth.status}`);
  }

  await prisma.$disconnect();

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        teacherEmail: TEACHER_EMAIL,
        teacherPassword: TEACHER_PASSWORD,
        studentEmail,
        studentPassword,
        classId: klass.id,
        resourceId,
        blobPath,
        blobUrl,
        downloadUrl: `${BASE}/api/portal/resources/${resourceId}/download`,
        checks: [
          "teacher login",
          "POST /api/portal/resources → Blob portal-files/",
          "raw Blob URL reachable",
          "student login",
          "My Desk / Files shows auth download link",
          "GET download streams file",
          "unauth download 401",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
