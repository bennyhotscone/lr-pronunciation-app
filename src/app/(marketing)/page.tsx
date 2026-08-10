import Link from "next/link";

const gateways = [
  {
    href: "/pronunciation",
    title: "Pronunciation Practice",
    description: "Practise English sounds, words and pronunciation.",
    cta: "Start Practising",
    accent: "from-teal/25 via-white to-accent-soft/60",
    border: "border-teal/35",
    delay: "0ms",
  },
  {
    href: "/games",
    title: "Vocabulary & Grammar Games",
    description: "Build your vocabulary and grammar through games and challenges.",
    cta: "Play & Learn",
    accent: "from-amber/30 via-white to-coral/15",
    border: "border-amber/45",
    delay: "90ms",
  },
  {
    href: "/login",
    title: "Student Portal",
    description:
      "Your lessons, goals, homework, files and learning diary — all in one place.",
    cta: "Open Portal",
    accent: "from-coral/20 via-white to-accent-soft/40",
    border: "border-coral/35",
    delay: "180ms",
  },
] as const;

export default function HomePage() {
  return (
    <section className="landing-hero flex flex-1 flex-col justify-center pb-8 pt-6 sm:pt-10">
      <div className="landing-fade-in mx-auto max-w-3xl text-center">
        <p className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-[0.06em] text-foreground sm:text-6xl md:text-7xl">
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
        {gateways.map((gateway) => (
          <Link
            key={gateway.href}
            href={gateway.href}
            className={`gateway-card landing-fade-up group flex min-h-[220px] flex-col justify-between rounded-[1.75rem] border-2 bg-gradient-to-br p-6 shadow-[0_14px_36px_rgba(28,22,48,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(28,22,48,0.12)] sm:min-h-[240px] sm:p-7 ${gateway.accent} ${gateway.border}`}
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
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-foreground transition group-hover:gap-2">
              {gateway.cta}
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
