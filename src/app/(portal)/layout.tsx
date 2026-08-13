import Link from "next/link";
import { requireRole } from "@/lib/portal-access";
import { getAvatar } from "@/lib/avatars";
import { signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { BrandWordmark } from "@/components/BrandMark";
import { ClassMoneyBadge } from "@/components/portal/ClassMoneyBadge";
import { normalizeDeskTheme } from "@/lib/desk-themes";
import { getOrCreateWalletBalance } from "@/lib/class-money-actions";

const studentLinks = [
  { href: "/portal", label: "My Desk" },
  { href: "/portal/resources", label: "Files" },
  { href: "/portal/vocab-practice", label: "Practice" },
  { href: "/portal/profile", label: "Profile" },
];

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("STUDENT");
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
  });
  const avatar = getAvatar(profile?.avatarId || session.user.avatarId);
  const name =
    profile?.preferredName || session.user.preferredName || session.user.name || "Student";
  const deskTheme = normalizeDeskTheme(profile?.deskTheme);
  const balance = await getOrCreateWalletBalance(session.user.id);

  return (
    <div className="theme-desk min-h-dvh" data-desk-theme={deskTheme}>
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-24 pt-3 sm:px-6 lg:max-w-7xl lg:px-8">
        <header className="flex items-center justify-between gap-3 border-b border-border/80 py-3">
          <Link href="/" className="text-ink">
            <BrandWordmark className="text-inherit" />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <ClassMoneyBadge balance={balance} />
            <Link
              href="/portal/profile"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-paper px-2.5 py-1.5 text-sm font-semibold text-ink"
            >
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg"
                style={{ background: avatar.bg }}
                aria-hidden
              >
                {avatar.emoji}
              </span>
              {name}
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
          </div>
        </header>
        <main className="flex-1 py-6">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[#f3f2ee]/95 backdrop-blur-sm">
          <ul className="mx-auto flex max-w-6xl items-stretch justify-around px-1 py-1 lg:max-w-7xl">
            {studentLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`touch-target flex min-w-[3.5rem] flex-col items-center justify-center px-2 py-2 text-xs font-bold text-ink ${
                    l.href === "/portal/resources" ? "text-desk-accent" : ""
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}