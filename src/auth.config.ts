import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

function isStaff(role: Role | string | undefined | null) {
  return role === "ADMIN" || role === "TEACHER";
}

/**
 * Edge-safe Auth.js config (no Prisma / Node APIs).
 * Full credentials provider lives in `src/auth.ts`.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = auth?.user?.role as Role | undefined;
      const isLoggedIn = Boolean(auth?.user);
      const isPortal = pathname.startsWith("/portal");
      const isTeacher = pathname.startsWith("/teacher");
      const isStudio =
        pathname === "/english-for-mandarin-speakers/studio" ||
        pathname.startsWith("/english-for-mandarin-speakers/studio/");
      const isLogin = pathname === "/login";
      const isSignup = pathname === "/signup";
      const isPasswordReset =
        pathname === "/forgot-password" || pathname === "/reset-password";
      const isJoin = pathname === "/join" || pathname.startsWith("/join/");
      // Join must stay reachable while logged in (students enter/use invite codes).
      const isAccountForm = isLogin || isSignup || isPasswordReset;

      if ((isPortal || isTeacher) && !isLoggedIn) return false;

      // API join: allow through so route can return JSON 401 (not HTML login redirect)
      if (pathname === "/api/portal/join") return true;

      if (isStudio) {
        if (!isLoggedIn) return false;
        if (role !== "ADMIN") {
          const dest = isStaff(role) ? "/teacher" : "/portal";
          return Response.redirect(new URL(dest, request.nextUrl.origin));
        }
        return true;
      }

      if (isPortal && role && role !== "STUDENT") {
        return Response.redirect(new URL("/teacher", request.nextUrl.origin));
      }
      if (isTeacher && role && !isStaff(role)) {
        return Response.redirect(new URL("/portal", request.nextUrl.origin));
      }

      // Bounce away from login/signup only — never block /join for students.
      if (isAccountForm && isLoggedIn) {
        const callback = request.nextUrl.searchParams.get("callbackUrl");
        const safe =
          callback &&
          callback.startsWith("/") &&
          !callback.startsWith("//") &&
          (callback.startsWith("/join") ||
            callback.startsWith("/portal") ||
            callback.startsWith("/teacher") ||
            callback.startsWith("/english-for-mandarin-speakers"));
        if (safe) {
          return Response.redirect(new URL(callback, request.nextUrl.origin));
        }
        const dest = isStaff(role) ? "/teacher" : "/portal";
        return Response.redirect(new URL(dest, request.nextUrl.origin));
      }

      if (isJoin) return true;
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = String(user.id);
        token.role = user.role;
        token.preferredName = user.preferredName ?? null;
        token.avatarId = user.avatarId ?? "fox";
      }
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as {
          preferredName?: string;
          avatarId?: string;
          name?: string;
        };
        if (typeof s.preferredName === "string") {
          token.preferredName = s.preferredName;
        }
        if (typeof s.avatarId === "string") {
          token.avatarId = s.avatarId;
        }
        if (typeof s.name === "string") {
          token.name = s.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id);
        session.user.role = token.role as typeof session.user.role;
        session.user.preferredName =
          typeof token.preferredName === "string" ? token.preferredName : null;
        session.user.avatarId =
          typeof token.avatarId === "string" ? token.avatarId : "fox";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
