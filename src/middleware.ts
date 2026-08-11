import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/portal/:path*",
    "/teacher/:path*",
    "/login",
    "/english-for-mandarin-speakers/studio",
    "/english-for-mandarin-speakers/studio/:path*",
  ],
};
