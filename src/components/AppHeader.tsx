"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/learn", label: "Learn", icon: "👂" },
  { href: "/practice", label: "Practice", icon: "🎙️" },
  { href: "/progress", label: "Progress", icon: "⭐" },
] as const;

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="card rounded-3xl px-3 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="touch-target inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground"
        >
          <span className="sound-badge sound-badge-l text-sm" aria-hidden="true">
            L
          </span>
          <span className="text-muted" aria-hidden="true">
            /
          </span>
          <span className="sound-badge sound-badge-r text-sm" aria-hidden="true">
            R
          </span>
          <span className="ml-1 bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
            L or R?
          </span>
        </Link>
        <p className="chip bg-amber/25 text-foreground">Free · on device</p>
      </div>
      <nav aria-label="Main" className="grid grid-cols-4 gap-1.5">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`touch-target inline-flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2 text-xs font-bold transition sm:text-sm ${
                active
                  ? "bg-gradient-to-br from-accent to-accent-2 text-white shadow-md shadow-accent/25"
                  : "bg-accent-soft/70 text-foreground hover:bg-accent-soft"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true" className="text-base leading-none">
                {link.icon}
              </span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
