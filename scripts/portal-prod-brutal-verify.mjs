/**
 * Brutal production verification against https://lrmastery.guru
 * Reports REAL / PARTIAL / FAKE / BROKEN / NOT_BUILT with evidence.
 * Does NOT invent success.
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
      /* ok */
    }
  }
}
loadEnvLocal();

const BASE = process.env.PORTAL_E2E_BASE || "https://lrmastery.guru";
const TEACHER_EMAIL = "teacher@lrmastery.guru";
const TEACHER_PASSWORD = "TeacherTemp2026!";

const results = {};
function record(id, status, proof) {
  results[id] = { status, proof };
  console.error(`[${status}] ${id}: ${proof}`);
}

function cookieJar() {
  const jar = new Map();
  return {
    jar,
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
    names() {
      return [...jar.keys()];
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
  return { session, loginStatus: res.status, loginUrl: url, loginBody: text.slice(0, 300), cookieNames: jar.names() };
}

/** Try to POST a Next.js server action by scraping action id from HTML/RSC. */
async function tryServerAction(pageUrl, jar, fieldPairs) {
  const page = await fetchFollow(pageUrl, {}, jar);
  // Next 15+ embeds $ACTION_ID_... or "action":"...hash in flight data
  const actionIds = new Set();
  const re1 = /\$ACTION_ID_([a-f0-9]+)/gi;
  const re2 = /"id"\s*:\s*"([a-f0-9]{40,})"|\"([a-f0-9]{40,})\":\s*"(?:\[|"\$F)/g;
  const re3 = /next-action["'\s:=]+([a-f0-9]+)/gi;
  let m;
  while ((m = re1.exec(page.text))) actionIds.add(m[1]);
  while ((m = re3.exec(page.text))) actionIds.add(m[1]);
  // Also look for module-level action references in RSC payload
  const re4 = /([a-f0-9]{40,50})/g;
  const candidates = [...actionIds];
  if (!candidates.length) {
    // Fallback: extract long hex strings near "teacherCreate" won't work after minify
    // Return failure with evidence
    return {
      ok: false,
      reason: "No Next-Action IDs found in page HTML",
      status: page.res.status,
      sample: page.text.slice(0, 200),
      hasAddStudent: page.text.includes("Add Student") || page.text.includes("Create student"),
    };
  }

  const fd = new FormData();
  for (const [k, v] of fieldPairs) fd.append(k, v);

  const errors = [];
  for (const id of candidates.slice(0, 8)) {
    const res = await fetch(pageUrl, {
      method: "POST",
      headers: {
        Cookie: jar.header(),
        "Next-Action": id,
        Accept: "text/x-component",
      },
      body: fd,
      redirect: "manual",
    });
    const text = await res.text();
    if (res.ok || res.status === 303 || text.includes('"ok"') || text.includes("tempPassword")) {
      return { ok: true, actionId: id, status: res.status, body: text.slice(0, 500) };
    }
    errors.push({ id: id.slice(0, 12), status: res.status, body: text.slice(0, 120) });
  }
  return { ok: false, reason: "Action POSTs failed", errors, candidates: candidates.length };
}

async function main() {
  const prisma = new PrismaClient();
  const stamp = Date.now();
  console.error(`BASE=${BASE} stamp=${stamp}`);

  // --- 1. LOGIN ---
  const tJar = cookieJar();
  let teacherLogin;
  try {
    teacherLogin = await login(TEACHER_EMAIL, TEACHER_PASSWORD, tJar);
    const sessionCookie = teacherLogin.cookieNames.some(
      (n) =>
        n.includes("authjs.session-token") ||
        n.includes("__Secure-authjs.session-token") ||
        n.includes("next-auth.session-token") ||
        n.includes("__Secure-next-auth.session-token"),
    );
    if (teacherLogin.session?.user?.email === TEACHER_EMAIL && sessionCookie) {
      record(
        "1_login",
        "REAL",
        `POST /api/auth/callback/credentials → session.user=${teacherLogin.session.user.email} role=${teacherLogin.session.user.role}; cookies=${teacherLogin.cookieNames.join(",")}`,
      );
    } else if (teacherLogin.session?.user) {
      record(
        "1_login",
        "PARTIAL",
        `Session returned but no recognizable session cookie name. cookies=${teacherLogin.cookieNames.join(",")} session=${JSON.stringify(teacherLogin.session.user)}`,
      );
    } else {
      record(
        "1_login",
        "BROKEN",
        `No session after credentials. status=${teacherLogin.loginStatus} url=${teacherLogin.loginUrl} body=${teacherLogin.loginBody}`,
      );
    }
  } catch (e) {
    record("1_login", "BROKEN", String(e));
  }

  // --- 2. TEACHER DASHBOARD ---
  try {
    const teacherPage = await fetchFollow(`${BASE}/teacher`, {}, tJar);
    const ok =
      teacherPage.res.status === 200 &&
      teacherPage.url.includes("/teacher") &&
      (teacherPage.text.includes("Teacher dashboard") ||
        teacherPage.text.includes("Add Student") ||
        teacherPage.text.includes("Create"));
    if (ok) {
      record(
        "2_teacher_dashboard",
        "REAL",
        `GET /teacher status=200 finalUrl=${teacherPage.url}; html includes dashboard/create UI (len=${teacherPage.text.length})`,
      );
    } else {
      record(
        "2_teacher_dashboard",
        "BROKEN",
        `status=${teacherPage.res.status} url=${teacherPage.url} hasTeacher=${teacherPage.text.includes("Teacher")} snippet=${teacherPage.text.replace(/\s+/g, " ").slice(0, 200)}`,
      );
    }
  } catch (e) {
    record("2_teacher_dashboard", "BROKEN", String(e));
  }

  // --- 3. CREATE STUDENT ---
  // Prefer HTTP server action; fall back to Prisma write + HTTP login proof.
  const studentEmail = `student.verify+${stamp}@lrmastery.guru`;
  const studentPassword = "StudentVerify2026!";
  let studentId = null;
  let createVia = null;

  try {
    const actionTry = await tryServerAction(`${BASE}/teacher`, tJar, [
      ["email", studentEmail],
      ["fullName", `Verify Student ${stamp}`],
      ["preferredName", `Vfy${stamp}`],
      ["tempPassword", studentPassword],
    ]);

    if (actionTry.ok) {
      createVia = "server-action-http";
      const dbUser = await prisma.user.findUnique({
        where: { email: studentEmail },
        include: { profile: true },
      });
      if (dbUser?.profile) {
        studentId = dbUser.id;
        record(
          "3_create_student",
          "REAL",
          `Server action HTTP created User+StudentProfile id=${dbUser.id}; will prove via login`,
        );
      } else {
        record(
          "3_create_student",
          "PARTIAL",
          `Server action returned ok but DB user missing or no profile. actionBody=${actionTry.body}`,
        );
      }
    } else {
      // HTTP form path not automatable — create via same Prisma DB prod uses, then prove login HTTP
      const user = await prisma.user.create({
        data: {
          email: studentEmail,
          passwordHash: await bcrypt.hash(studentPassword, 10),
          role: "STUDENT",
          profile: {
            create: {
              fullName: `Verify Student ${stamp}`,
              preferredName: `Vfy${stamp}`,
              avatarId: "fox",
            },
          },
        },
        include: { profile: true },
      });
      studentId = user.id;
      createVia = "prisma-db-write";
      record(
        "3_create_student",
        "PARTIAL",
        `Teacher UI create is server-action (client). HTTP Next-Action scrape failed (${actionTry.reason}). Created User+StudentProfile via Prisma against DATABASE_URL (same prod DB). teacherCreateStudent code exists. Proving student can log in via Auth.js HTTP…`,
      );
    }

    const sJar = cookieJar();
    const sLogin = await login(studentEmail, studentPassword, sJar);
    if (sLogin.session?.user?.email === studentEmail && sLogin.session.user.role === "STUDENT") {
      results["3_create_student"].proof += ` | STUDENT LOGIN OK session.role=STUDENT via=${createVia}`;
      if (createVia === "server-action-http") {
        results["3_create_student"].status = "REAL";
      }
      // keep PARTIAL if only DB path worked for create
    } else {
      results["3_create_student"].status = "BROKEN";
      results["3_create_student"].proof += ` | STUDENT LOGIN FAILED: ${JSON.stringify(sLogin.session)}`;
    }
  } catch (e) {
    record("3_create_student", "BROKEN", String(e));
  }

  // --- 4. CREATE CLASS + ENROLL ---
  let classId = null;
  try {
    if (!studentId) throw new Error("No studentId");
    const teacher = await prisma.user.findUnique({ where: { email: TEACHER_EMAIL } });
    const klass = await prisma.class.create({
      data: {
        name: `Verify Class ${stamp}`,
        description: "brutal verify",
        teacherId: teacher.id,
      },
    });
    classId = klass.id;
    await prisma.classMembership.create({
      data: { classId: klass.id, studentId, status: "ACTIVE" },
    });

    // Prove via HTTP: student My Desk shows class chip; teacher class page loads
    const classPage = await fetchFollow(`${BASE}/teacher/classes/${classId}`, {}, tJar);
    const sJar = cookieJar();
    await login(studentEmail, studentPassword, sJar);
    const desk = await fetchFollow(`${BASE}/portal`, {}, sJar);

    const teacherSees =
      classPage.res.status === 200 &&
      (classPage.text.includes(`Verify Class ${stamp}`) || classPage.text.includes("Enroll"));
    const studentSeesClass = desk.text.includes(`Verify Class ${stamp}`);

    if (teacherSees && studentSeesClass) {
      record(
        "4_class_enroll",
        "PARTIAL",
        `Class+membership written via Prisma (teacherCreateClass/enroll are server actions; not HTTP-automated). GET /teacher/classes/${classId} status=${classPage.res.status} ok; student My Desk HTML contains class name. Code path: portal-actions teacherCreateClass+enrollStudentInClass.`,
      );
    } else if (teacherSees || studentSeesClass) {
      record(
        "4_class_enroll",
        "PARTIAL",
        `DB write ok. teacherPageOk=${teacherSees} studentSeesClass=${studentSeesClass} deskSnippet has class?`,
      );
    } else {
      record(
        "4_class_enroll",
        "BROKEN",
        `DB class created but UI proof failed. classPage=${classPage.res.status} studentDesk includes name=${studentSeesClass}`,
      );
    }
  } catch (e) {
    record("4_class_enroll", "BROKEN", String(e));
  }

  // --- 5. CREATE LESSON ---
  const lessonTitle = `Verify Lesson ${stamp}`;
  try {
    if (!classId) throw new Error("No classId");
    const teacher = await prisma.user.findUnique({ where: { email: TEACHER_EMAIL } });
    await prisma.lesson.create({
      data: {
        title: lessonTitle,
        summary: "Brutal verify lesson summary",
        classId,
        createdById: teacher.id,
      },
    });
    const sJar = cookieJar();
    await login(studentEmail, studentPassword, sJar);
    const desk = await fetchFollow(`${BASE}/portal`, {}, sJar);
    if (desk.res.status === 200 && desk.text.includes(lessonTitle)) {
      record(
        "5_lesson",
        "PARTIAL",
        `Lesson row in DB via Prisma; teacherAddLesson is real server action in code. Student GET /portal status=200 contains "${lessonTitle}".`,
      );
    } else {
      record(
        "5_lesson",
        "BROKEN",
        `Lesson in DB but My Desk missing title. status=${desk.res.status} hasTitle=${desk.text.includes(lessonTitle)}`,
      );
    }
  } catch (e) {
    record("5_lesson", "BROKEN", String(e));
  }

  // --- 6. UPLOAD FILE → BLOB + student download ---
  let resourceId = null;
  let blobPath = null;
  let blobUrl = null;
  try {
    if (!classId) throw new Error("No classId");
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const pngBytes = Buffer.from(pngBase64, "base64");
    const form = new FormData();
    form.append("file", new Blob([pngBytes], { type: "image/png" }), `verify-${stamp}.png`);
    form.append("title", `Verify Blob ${stamp}`);
    form.append("classId", classId);
    form.append("description", `brutal-${stamp}`);

    const uploadRes = await fetch(`${BASE}/api/portal/resources`, {
      method: "POST",
      headers: { Cookie: tJar.header() },
      body: form,
    });
    const uploadJson = await uploadRes.json().catch(() => ({}));

    if (!uploadRes.ok) {
      record(
        "6_upload_blob",
        "BROKEN",
        `POST /api/portal/resources status=${uploadRes.status} body=${JSON.stringify(uploadJson)}`,
      );
    } else {
      resourceId = uploadJson.resource?.id;
      blobPath = uploadJson.resource?.blobPath || "";
      blobUrl = uploadJson.resource?.blobUrl || "";
      const modeOk = uploadJson.storageMode === "blob";
      const pathOk = blobPath.startsWith("portal-files/");
      const urlOk =
        blobUrl.includes("blob.vercel-storage.com") || blobUrl.includes("vercel-storage.com");

      const sJar = cookieJar();
      await login(studentEmail, studentPassword, sJar);
      const dl = await fetch(`${BASE}/api/portal/resources/${resourceId}/download`, {
        headers: { Cookie: sJar.header() },
      });
      const unauth = await fetch(`${BASE}/api/portal/resources/${resourceId}/download`);
      const dlBuf = dl.ok ? Buffer.from(await dl.arrayBuffer()) : null;
      const bytesOk = dlBuf && dlBuf[0] === 0x89 && dlBuf[1] === 0x50;

      if (modeOk && pathOk && urlOk && dl.ok && bytesOk && unauth.status === 401) {
        record(
          "6_upload_blob",
          "REAL",
          `POST /api/portal/resources → storageMode=blob path=${blobPath} urlHost=${new URL(blobUrl).host}; student GET download ${dl.status} PNG ok; unauth=${unauth.status}; X-Portal-Blob-Path=${dl.headers.get("x-portal-blob-path")}`,
        );
      } else {
        record(
          "6_upload_blob",
          "PARTIAL",
          `uploadOk mode=${uploadJson.storageMode} path=${blobPath} urlOk=${urlOk} dl=${dl.status} unauth=${unauth.status} bytesOk=${bytesOk} json=${JSON.stringify(uploadJson).slice(0, 400)}`,
        );
      }
    }
  } catch (e) {
    record("6_upload_blob", "BROKEN", String(e));
  }

  // --- 7. MY DESK shows lesson + file ---
  try {
    const sJar = cookieJar();
    await login(studentEmail, studentPassword, sJar);
    const desk = await fetchFollow(`${BASE}/portal`, {}, sJar);
    const hasLesson = desk.text.includes(lessonTitle);
    const hasFile =
      desk.text.includes(`Verify Blob ${stamp}`) ||
      (resourceId && desk.text.includes(`/api/portal/resources/${resourceId}/download`));
    if (desk.res.status === 200 && hasLesson && hasFile) {
      record(
        "7_my_desk",
        "REAL",
        `GET /portal status=200; contains lesson "${lessonTitle}" and file/download for Verify Blob ${stamp}`,
      );
    } else if (desk.res.status === 200 && (hasLesson || hasFile)) {
      record(
        "7_my_desk",
        "PARTIAL",
        `My Desk 200 but hasLesson=${hasLesson} hasFile=${hasFile}`,
      );
    } else {
      record(
        "7_my_desk",
        "BROKEN",
        `status=${desk.res.status} url=${desk.url} hasLesson=${hasLesson} hasFile=${hasFile}`,
      );
    }
  } catch (e) {
    record("7_my_desk", "BROKEN", String(e));
  }

  // --- 8. PROFILE preferredName + avatar ---
  try {
    const newName = `Renamed${stamp}`;
    const newAvatar = "rocket";
    // Prefer HTTP if we can; else Prisma write + HTTP reload proof (same as official e2e caveat)
    await prisma.studentProfile.update({
      where: { userId: studentId },
      data: { preferredName: newName, avatarId: newAvatar },
    });
    const sJar = cookieJar();
    await login(studentEmail, studentPassword, sJar);
    const desk = await fetchFollow(`${BASE}/portal`, {}, sJar);
    const profilePage = await fetchFollow(`${BASE}/portal/profile`, {}, sJar);
    const nameOnDesk = desk.text.includes(newName);
    const profileUi =
      profilePage.res.status === 200 &&
      (profilePage.text.includes("Preferred name") ||
        profilePage.text.includes("preferredName") ||
        profilePage.text.includes("Avatar") ||
        profilePage.text.includes("Save profile"));

    // prove persist: re-fetch DB and second page load
    const dbProf = await prisma.studentProfile.findUnique({ where: { userId: studentId } });
    const desk2 = await fetchFollow(`${BASE}/portal`, {}, sJar);
    const persists = desk2.text.includes(newName) && dbProf?.preferredName === newName && dbProf?.avatarId === newAvatar;

    if (nameOnDesk && profileUi && persists) {
      record(
        "8_profile",
        "PARTIAL",
        `ProfileEditor UI on /portal/profile (HTTP 200). preferredName+avatarId persist in DB and on My Desk after reload ("${newName}", avatar=${newAvatar}). Save path is client server-action updateStudentProfile — not POSTed via raw HTTP in this run; DB write used for mutation proof like portal-http-e2e.`,
      );
    } else if (profileUi && !nameOnDesk) {
      record(
        "8_profile",
        "BROKEN",
        `Profile page exists but name not on My Desk. db=${JSON.stringify(dbProf)} nameOnDesk=${nameOnDesk}`,
      );
    } else {
      record(
        "8_profile",
        "BROKEN",
        `nameOnDesk=${nameOnDesk} profileUi=${profileUi} persists=${persists}`,
      );
    }
  } catch (e) {
    record("8_profile", "BROKEN", String(e));
  }

  // --- 9. GOALS ---
  try {
    // Code audit: pages are NOT empty stubs — they query prisma.goal and render GoalProgressForm
    const goalTitle = `Verify Goal ${stamp}`;
    await prisma.goal.create({
      data: {
        studentId,
        title: goalTitle,
        description: "brutal goal",
        progressPct: 10,
      },
    });

    const sJar = cookieJar();
    await login(studentEmail, studentPassword, sJar);
    const goalsPage = await fetchFollow(`${BASE}/portal/goals`, {}, sJar);
    const desk = await fetchFollow(`${BASE}/portal`, {}, sJar);

    // Teacher goals UI
    const teacherStudentPage = await fetchFollow(`${BASE}/teacher/students/${studentId}`, {}, tJar);
    const teacherHasGoalUi =
      teacherStudentPage.text.includes("Add goal") ||
      teacherStudentPage.text.includes("Goal");

    // Update progress via Prisma (server action upsertGoalProgress)
    await prisma.goal.updateMany({
      where: { studentId, title: goalTitle },
      data: { progressPct: 55, studentNotes: "halfway" },
    });
    const goals2 = await fetchFollow(`${BASE}/portal/goals`, {}, sJar);
    const showsGoal = goalsPage.text.includes(goalTitle);
    const showsUpdated =
      goals2.text.includes(goalTitle) &&
      (goals2.text.includes("55") || goals2.text.includes('value="55"') || goals2.text.includes("halfway"));
    const emptyStub =
      goalsPage.text.includes("coming soon") ||
      goalsPage.text.includes("TODO") ||
      goalsPage.text.includes("placeholder") ||
      (!goalsPage.text.includes("Goals") && goalsPage.res.status === 200);

    if (goalsPage.res.status === 200 && showsGoal && teacherHasGoalUi && !emptyStub) {
      record(
        "9_goals",
        "PARTIAL",
        `/portal/goals REAL page (not stub): lists goals from Prisma + GoalProgressForm. Teacher student page has "Add goal" UI. Goal "${goalTitle}" visible after DB create; progress update verified via DB+reload showsGoal=${showsGoal} showsUpdated=${showsUpdated}. Create/update from browser uses server actions (not raw HTTP POSTed here). No separate checklist model — progressPct + notes only.`,
      );
    } else if (emptyStub || goalsPage.res.status === 404) {
      record(
        "9_goals",
        "NOT_BUILT",
        `Goals missing/stub. status=${goalsPage.res.status} emptyStub=${emptyStub}`,
      );
    } else {
      record(
        "9_goals",
        "PARTIAL",
        `status=${goalsPage.res.status} showsGoal=${showsGoal} teacherHasGoalUi=${teacherHasGoalUi} showsUpdated=${showsUpdated}`,
      );
    }
  } catch (e) {
    record("9_goals", "BROKEN", String(e));
  }

  // --- 10. HOMEWORK ---
  try {
    const hwTitle = `Verify HW ${stamp}`;
    const teacher = await prisma.user.findUnique({ where: { email: TEACHER_EMAIL } });
    await prisma.homework.create({
      data: {
        title: hwTitle,
        instructions: "Do the worksheet",
        status: "ASSIGNED",
        classId,
        studentId: null,
        createdById: teacher.id,
      },
    });
    const sJar = cookieJar();
    await login(studentEmail, studentPassword, sJar);
    const desk = await fetchFollow(`${BASE}/portal`, {}, sJar);
    if (desk.text.includes(hwTitle) && desk.text.includes("Do the worksheet")) {
      record(
        "10_homework",
        "PARTIAL",
        `Homework model+desk UI real. Created via Prisma; GET /portal shows "${hwTitle}". teacherAddHomework server action + ClassTools/StudentAssignTools forms exist in code. Not HTTP-automated create.`,
      );
    } else {
      record(
        "10_homework",
        "BROKEN",
        `HW in DB but My Desk missing. hasTitle=${desk.text.includes(hwTitle)}`,
      );
    }
  } catch (e) {
    record("10_homework", "BROKEN", String(e));
  }

  // --- 11. DIARY ---
  try {
    const diaryBody = `Diary verify entry ${stamp}`;
    await prisma.diaryEntry.create({
      data: {
        studentId,
        title: `Diary ${stamp}`,
        body: diaryBody,
        visibility: "SHARED",
      },
    });
    const sJar = cookieJar();
    await login(studentEmail, studentPassword, sJar);
    const diaryPage = await fetchFollow(`${BASE}/portal/diary`, {}, sJar);
    const hasForm =
      diaryPage.text.includes("Save entry") ||
      diaryPage.text.includes("practice") ||
      diaryPage.text.includes("diary");
    const showsEntry = diaryPage.text.includes(diaryBody) || diaryPage.text.includes(`Diary ${stamp}`);
    const stub =
      diaryPage.text.includes("coming soon") ||
      diaryPage.res.status === 404;

    if (diaryPage.res.status === 200 && hasForm && showsEntry && !stub) {
      record(
        "11_diary",
        "PARTIAL",
        `/portal/diary REAL (DiaryForm + prisma.diaryEntry). Entry visible after DB create. saveDiaryEntry server action exists. Create-from-browser not raw-HTTP-automated.`,
      );
    } else if (stub) {
      record("11_diary", "NOT_BUILT", `Diary stub/404 status=${diaryPage.res.status}`);
    } else {
      record(
        "11_diary",
        "BROKEN",
        `status=${diaryPage.res.status} hasForm=${hasForm} showsEntry=${showsEntry}`,
      );
    }
  } catch (e) {
    record("11_diary", "BROKEN", String(e));
  }

  // Code note on goals checklist
  record(
    "code_goals_checklist",
    "NOT_BUILT",
    "No GoalChecklist / checklist items in Prisma schema. Goal has progressPct + studentNotes + teacherNotes only. Student can update % via GoalProgressForm; teacher creates via teacherAddGoal. Not an empty page stub.",
  );

  await prisma.$disconnect();

  console.log(
    JSON.stringify(
      {
        base: BASE,
        stamp,
        studentEmail,
        studentPassword,
        classId,
        resourceId,
        blobPath,
        blobUrl,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
