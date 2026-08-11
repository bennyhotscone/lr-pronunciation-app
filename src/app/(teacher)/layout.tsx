import Link from "next/link";
import { requireStaff, isAdmin } from "@/lib/portal-access";
import { signOut } from "@/auth";
import { BrandWordmark } from "@/components/BrandMark";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaff();
  const admin = isAdmin(session.user.role);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-12 pt-3 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/">
            <BrandWordmark />
          </Link>
          <nav className="flex items-center gap-3 text-sm font-bold">
            <Link href="/teacher" className="hover:text-sand-accent">
              Dashboard
            </Link>
            {admin ? (
              <>
                <span className="chip bg-sand-accent/25 text-sand-accent">Admin</span>
                <Link
                  href="/english-for-mandarin-speakers/studio"
                  className="text-sand-accent hover:underline"
                >
                  Studio
                </Link>
              </>
            ) : null}
          </nav>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="text-sm font-semibold text-muted hover:text-foreground">
            Log out
          </button>
        </form>
      </header>
      <main className="flex-1 py-4">{children}</main>
    </div>
  );
}
