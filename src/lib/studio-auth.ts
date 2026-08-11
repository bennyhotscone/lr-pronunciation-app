import { auth } from "@/auth";
import { STUDIO_PASSWORD_FALLBACK } from "@/lib/studio-progress";

export function getStudioPassword(): string {
  return process.env.MANDARIN_STUDIO_PASSWORD?.trim() || STUDIO_PASSWORD_FALLBACK;
}

export function checkStudioPassword(password: unknown): boolean {
  return typeof password === "string" && password.length > 0 && password === getStudioPassword();
}

/** Read password from Authorization Bearer, x-studio-password header, or JSON/form field. */
export function passwordFromRequest(
  request: Request,
  bodyPassword?: unknown,
): string | null {
  const header = request.headers.get("x-studio-password");
  if (header?.trim()) return header.trim();
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  if (typeof bodyPassword === "string" && bodyPassword.trim()) {
    return bodyPassword.trim();
  }
  return null;
}

/**
 * Studio mutating APIs require an authenticated ADMIN session.
 * Optional studio password may still be sent by legacy clients but is no longer required.
 */
export async function requireStudioAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}
