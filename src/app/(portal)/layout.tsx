import Link from "next/link";
import { requireRole } from "@/lib/portal-access";
import { getAvatar } from "@/lib/avatars";
import { signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { BrandWordmark } from "@/components/BrandMark";

const studentLinks = [
  { href: "/portal", label: "My Desk" },
  { href: "/portal/lessons", label: "Lessons" },
  { href: "/portal/resources", label: "Files" },
  { href: "/portal/goals", label: "Goals" },
  { href: "/portal/diary", label: "Diary" },
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-24 pt-3 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-2">
        <Link href="/">
          <BrandWordmark />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/portal/profile"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-2.5 py-1.5 text-sm font-semibold"
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
            <button type="submit" className="text-sm font-semibold text-muted hover:text-foreground">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 py-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-[#1a1714]/95 backdrop-blur">
        <ul className="mx-auto flex max-w-5xl items-stretch justify-around px-1 py-1">
          {studentLinks.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="touch-target flex min-w-[3.5rem] flex-col items-center justify-center px-2 py-2 text-[0.7rem] font-bold text-foreground/80"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
