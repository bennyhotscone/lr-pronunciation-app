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
    <div className="theme-blackboard min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-12 pt-3 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-chalk/15 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/" className="text-chalk hover:text-chalk-accent">
              <BrandWordmark className="text-inherit" />
            </Link>
            <nav className="flex items-center gap-3 text-sm font-bold text-chalk/85">
              <Link href="/teacher" className="hover:text-chalk-accent">
                Classrooms
              </Link>
              <Link href="/teacher/lesson-capture" className="hover:text-chalk-accent">
                Lesson capture
              </Link>
              {admin ? (
                <>
                  <span className="rounded bg-chalk-accent/20 px-2 py-0.5 text-xs text-chalk-accent">
                    Admin
                  </span>
                  <Link
                    href="/english-for-mandarin-speakers/studio"
                    className="text-chalk-accent hover:underline"
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
            <button type="submit" className="text-sm font-semibold text-chalk/55 hover:text-chalk">
              Log out
            </button>
          </form>
        </header>
        <main className="flex-1 py-5">{children}</main>
      </div>
    </div>
  );
}
