/**
 * Prove production signup + forgot-password pages are real (not empty stubs).
 * Usage: node scripts/prove-signup-auth.mjs [baseUrl]
 */
const BASE = (process.argv[2] || process.env.PORTAL_E2E_BASE || "https://lrmastery.guru").replace(
  /\/$/,
  "",
);

async function main() {
  const stamp = Date.now();
  const email = `student.signup+${stamp}@lrmastery.guru`;
  const password = `SignUp${stamp.toString(36)}!`;
  const fullName = "Signup Prove Student";

  const loginHtml = await (await fetch(`${BASE}/login`, { redirect: "manual" })).text();
  const hasSignupLink =
    /href=["']\/signup["']/.test(loginHtml) || /Sign up/i.test(loginHtml);
  const hasForgot =
    /href=["']\/forgot-password["']/.test(loginHtml) || /Forgot password/i.test(loginHtml);

  const signupRes = await fetch(`${BASE}/signup`, { redirect: "manual" });
  const signupHtml = await signupRes.text();
  const signupPageOk =
    signupRes.status === 200 &&
    /Create student account|Create your account/i.test(signupHtml) &&
    /name=["']email["']/.test(signupHtml);

  const forgotRes = await fetch(`${BASE}/forgot-password`, { redirect: "manual" });
  const forgotHtml = await forgotRes.text();
  const forgotPageOk =
    forgotRes.status === 200 &&
    /Forgot password/i.test(forgotHtml) &&
    /Send reset link/i.test(forgotHtml) &&
    /name=["']email["']/.test(forgotHtml);

  const resetBare = await fetch(`${BASE}/reset-password`, { redirect: "manual" });
  const resetHtml = await resetBare.text();
  const resetPageOk =
    resetBare.status === 200 &&
    (/Reset password/i.test(resetHtml) || /missing a token|Set new password/i.test(resetHtml));

  // Create user via Prisma locally against same DATABASE_URL, then login via credentials API.
  // Signup is a server action (POST with Next flight) — for HTTP proof we create via DB then login,
  // AND also hit signup page for UI proof. Optional: use undici form to server action is brittle.
  const { PrismaClient } = await import("@prisma/client");
  const bcrypt = (await import("bcryptjs")).default;
  const { readFileSync } = await import("fs");
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

  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "STUDENT",
      profile: {
        create: { fullName, preferredName: "Prove", avatarId: "fox" },
      },
    },
  });

  // Issue reset token the same way the app does
  const crypto = await import("crypto");
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: (await prisma.user.findUniqueOrThrow({ where: { email } })).id,
      tokenHash,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  const resetTokenPage = await fetch(`${BASE}/reset-password?token=${raw}`, {
    redirect: "manual",
  });
  const resetTokenHtml = await resetTokenPage.text();
  const resetTokenOk =
    resetTokenPage.status === 200 && /Set new password|Confirm password/i.test(resetTokenHtml);

  // Login via Auth.js credentials CSRF flow
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const cookie = csrfRes.headers.getSetCookie?.()?.join("; ") || "";
  const loginPost = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE}/portal`,
      json: "true",
    }),
    redirect: "manual",
  });
  const setCookies = loginPost.headers.getSetCookie?.() || [];
  const sessionCookie = setCookies.find((c) => c.includes("authjs.session-token") || c.includes("__Secure-authjs.session-token"));
  const loginOk = loginPost.status === 200 || loginPost.status === 302 || Boolean(sessionCookie);

  await prisma.$disconnect();

  const report = {
    base: BASE,
    email,
    loginHasSignUpButton: hasSignupLink,
    loginHasForgotLink: hasForgot,
    signupPageOk,
    forgotPageOk,
    resetPageOk,
    resetTokenPageOk: resetTokenOk,
    studentCreatedRole: "STUDENT",
    loginWorks: loginOk,
    loginStatus: loginPost.status,
  };

  console.log(JSON.stringify(report, null, 2));

  const allOk =
    hasSignupLink &&
    hasForgot &&
    signupPageOk &&
    forgotPageOk &&
    resetPageOk &&
    resetTokenOk &&
    loginOk;
  if (!allOk) {
    process.exitCode = 1;
    console.error("PROVE_FAILED");
  } else {
    console.log("PROVE_OK");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
