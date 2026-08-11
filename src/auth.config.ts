import type { NextAuthConfig } from "next-auth";

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
      const role = auth?.user?.role;
      const isLoggedIn = Boolean(auth?.user);
      const isPortal = pathname.startsWith("/portal");
      const isTeacher = pathname.startsWith("/teacher");
      const isLogin = pathname === "/login";

      if ((isPortal || isTeacher) && !isLoggedIn) return false;
      if (isPortal && role && role !== "STUDENT") {
        return Response.redirect(new URL("/teacher", request.nextUrl.origin));
      }
      if (isTeacher && role && role !== "TEACHER") {
        return Response.redirect(new URL("/portal", request.nextUrl.origin));
      }
      if (isLogin && isLoggedIn) {
        const dest = role === "TEACHER" ? "/teacher" : "/portal";
        return Response.redirect(new URL(dest, request.nextUrl.origin));
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.preferredName = user.preferredName ?? null;
        token.avatarId = user.avatarId ?? "fox";
      }
      if (trigger === "update" && session) {
        if (typeof session.preferredName === "string") {
          token.preferredName = session.preferredName;
        }
        if (typeof session.avatarId === "string") {
          token.avatarId = session.avatarId;
        }
        if (typeof session.name === "string") {
          token.name = session.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.preferredName = token.preferredName ?? null;
        session.user.avatarId = token.avatarId ?? "fox";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
