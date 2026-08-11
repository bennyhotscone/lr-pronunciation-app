"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * Binder-style portal gateway: cover + flap open visually, then navigate.
 * Visible copy uses normal portal labels only (no metaphor captions).
 */
export function PortalDeskGateway({
  href,
  description,
}: {
  href: string;
  description: string;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const openDesk = useCallback(() => {
    if (opening) return;
    const prefersReduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(prefersReduce);
    if (prefersReduce) {
      router.push(href);
      return;
    }
    setOpening(true);
    window.setTimeout(() => {
      router.push(href);
    }, 780);
  }, [href, opening, router]);

  return (
    <button
      type="button"
      onClick={openDesk}
      disabled={opening}
      className="gateway-desk gateway-interactive landing-fade-up group relative flex min-h-[260px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-sand-border text-left shadow-[0_18px_40px_rgba(0,0,0,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand-accent disabled:cursor-wait"
      style={{ animationDelay: "0ms" }}
      aria-label="Open Student Portal"
    >
      <span className="sr-only">{description}</span>

      {/* Interior (revealed as cover opens) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2c261f] via-[#1f1b16] to-[#151210] p-6">
        <div className="flex h-full flex-col justify-between">
          <div>
            <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[#f0e6d4]">
              Student Portal
            </p>
            <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-[#c4b8a4]">
              {description}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-[#d4c4a8]">
            Enter My Desk
            <span aria-hidden>→</span>
          </span>
        </div>
        <div
          aria-hidden
          className="absolute left-3 top-1/2 flex -translate-y-1/2 flex-col gap-3"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full border border-[#8b7355] bg-[#3a342c] shadow-inner"
            />
          ))}
        </div>
      </div>

      {/* Left flap */}
      <div
        aria-hidden
        className={`desk-flap absolute inset-y-0 left-0 z-20 w-[18%] origin-left bg-gradient-to-r from-[#4a4034] to-[#3a342c] ${
          opening && !reducedMotion ? "desk-flap-open" : ""
        }`}
      >
        <div className="absolute inset-y-4 right-1 w-px bg-[#6b5a45]/60" />
      </div>

      {/* Main cover */}
      <div
        aria-hidden
        className={`desk-cover absolute inset-0 z-10 origin-left bg-gradient-to-br from-[#5c4f3e] via-[#3f362c] to-[#2a241c] ${
          opening && !reducedMotion ? "desk-cover-open" : ""
        }`}
      >
        <div className="absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(90deg,transparent,transparent_11px,rgba(0,0,0,0.12)_12px)]" />
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#6d5c48]/80 to-transparent" />
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 rounded-md border border-[#8b7355]/50 bg-[#2a241c]/55 px-4 py-5 text-center shadow-inner transition group-hover:border-sand-accent/70 group-hover:bg-[#2a241c]/75">
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[0.12em] text-[#f0e6d4] sm:text-2xl">
            Student Portal
          </p>
          <p className="mt-2 text-sm font-semibold text-[#c4b8a4]">My Desk</p>
        </div>
        <div className="absolute inset-y-6 right-[18%] w-2 rounded-full bg-gradient-to-b from-[#8b7355] via-[#6b5a45] to-[#8b7355] opacity-80 shadow-md" />
        <div className="absolute bottom-5 left-0 right-0 text-center text-xs font-bold tracking-wide text-[#c4b8a4]/90 transition group-hover:text-[#f0e6d4]">
          {opening ? "Opening…" : "Open portal →"}
        </div>
      </div>
    </button>
  );
}
