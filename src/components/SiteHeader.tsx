import { auth, signOut } from "@/auth";
import Link from "next/link";
import { getAvatar } from "@/lib/avatars";
import { BrandWordmark } from "@/components/BrandMark";
import { isStaff } from "@/lib/portal-access";

export async function SiteHeader() {
  const session = await auth();
  const role = session?.user?.role;
  const avatar = getAvatar(session?.user?.avatarId);

  return (
    <header className="relative z-20 flex items-center justify-between gap-4 py-3">
      <Link href="/" className="touch-target">
        <BrandWordmark />
      </Link>
      <div className="flex items-center gap-2">
        {session?.user ? (
          <>
            {isStaff(role) ? (
              <Link
                href="/teacher"
                className="touch-target inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface/80 px-3.5 py-2 text-sm font-bold text-foreground transition hover:border-sand-accent/50"
              >
                {role === "ADMIN" ? (
                  <span className="chip bg-sand-accent/25 text-sand-accent">Admin</span>
                ) : null}
                Dashboard
              </Link>
            ) : (
              <Link
                href="/portal"
                className="touch-target inline-flex items-center gap-2 rounded-xl border border-border bg-surface/80 px-3.5 py-2 text-sm font-bold text-foreground transition hover:border-sand-accent/50"
              >
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-base"
                  style={{ background: avatar.bg }}
                >
                  {avatar.emoji}
                </span>
                My Desk
              </Link>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="touch-target inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:text-foreground"
              >
                Log out
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            className="touch-target inline-flex items-center justify-center rounded-xl border border-border bg-surface/80 px-3.5 py-2 text-sm font-bold text-foreground transition hover:border-sand-accent/50"
          >
            Log In
          </Link>
        )}
      </div>
    </header>
  );
}
