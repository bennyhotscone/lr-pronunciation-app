import Link from "next/link";
import { requireRole } from "@/lib/portal-access";
import { signOut } from "@/auth";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("TEACHER");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-12 pt-3 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[0.04em]">
            LR MASTERY
          </Link>
          <nav className="flex gap-3 text-sm font-bold">
            <Link href="/teacher">Dashboard</Link>
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
