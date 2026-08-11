import Link from "next/link";
import { PortalDeskGateway } from "@/components/PortalDeskGateway";

const secondaryGateways = [
  {
    href: "/games",
    title: "Vocabulary & Grammar Games",
    description: "Build vocabulary and grammar through focused games and challenges.",
    cta: "Play & Learn",
    delay: "90ms",
  },
  {
    href: "/pronunciation",
    title: "Pronunciation Practice",
    description: "Practise English sounds, words, and clear speech.",
    cta: "Start Practising",
    delay: "180ms",
  },
] as const;

export default function HomePage() {
  return (
    <section className="landing-hero flex flex-1 flex-col justify-center pb-8 pt-6 sm:pt-10">
      <div className="landing-fade-in mx-auto max-w-3xl text-center">
        <p className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-[0.1em] text-foreground sm:text-6xl md:text-7xl">
          LR MASTERY
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight text-foreground/90 sm:text-3xl md:text-4xl">
          Master English your way.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Choose how you want to practise today.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {/* 1. Student Portal — leftmost / first */}
        <PortalDeskGateway
          href="/login"
          description="Your lessons, goals, homework, files and learning diary — all in one place."
        />

        {/* 2. Games · 3. Pronunciation */}
        {secondaryGateways.map((gateway) => (
          <Link
            key={gateway.href}
            href={gateway.href}
            className="gateway-card gateway-interactive landing-fade-up group flex min-h-[260px] cursor-pointer flex-col justify-between rounded-2xl border border-sand-border p-6 shadow-[0_14px_36px_rgba(0,0,0,0.28)] sm:p-7"
            style={{ animationDelay: gateway.delay }}
          >
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">
                {gateway.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                {gateway.description}
              </p>
            </div>
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-sand-accent transition group-hover:gap-2.5 group-hover:text-[#e8d5b5]">
              {gateway.cta}
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
