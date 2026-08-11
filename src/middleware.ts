import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/portal/:path*",
    "/teacher/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/join",
    "/join/:path*",
    "/english-for-mandarin-speakers/studio",
    "/english-for-mandarin-speakers/studio/:path*",
  ],
};
