import Link from "next/link";
import { signOut } from "@/auth";
import { BrandWordmark } from "@/components/BrandMark";
import { homeForRole, isStaff, requireJapaneseLearner } from "@/lib/portal-access";

export default async function LearnJapaneseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireJapaneseLearner();
  const backHref = isStaff(session.user.role) ? "/teacher" : homeForRole(session.user.role);
  const backLabel = isStaff(session.user.role) ? "Back to Teacher" : "Back to My Desk";

  return (
    <div className="theme-desk min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 pb-12 pt-3 sm:px-6">
        <header className="flex items-center justify-between gap-3 border-b border-border/80 py-3">
          <Link href="/" className="text-ink">
            <BrandWordmark className="text-inherit" />
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit" className="text-sm font-semibold text-muted hover:text-ink">
              Log out
            </button>
          </form>
        </header>
        <main className="flex-1 py-6">
          <Link href={backHref} className="text-sm font-bold text-desk-accent hover:underline">
            {backLabel}
          </Link>
          <div className="mt-4">{children}</div>
        </main>
      </div>
    </div>
  );
}