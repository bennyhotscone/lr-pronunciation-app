import Image from "next/image";
import Link from "next/link";

const practicePaths = [
  {
    href: "/login",
    title: "Student Portal",
    description: "Lessons, goals, homework, files, and your learning diary.",
    cta: "Enter My Desk",
  },
  {
    href: "/games",
    title: "Vocabulary & Grammar",
    description: "Build vocabulary and grammar through focused games.",
    cta: "Play & Learn",
  },
  {
    href: "/pronunciation",
    title: "Pronunciation",
    description: "Practise English sounds, words, and clear speech.",
    cta: "Start Practising",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="landing-hero" aria-labelledby="landing-brand">
        <div className="landing-hero-media" aria-hidden>
          <Image
            src="/marketing/hero-classroom-desk.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="landing-hero-photo"
          />
          <div className="landing-hero-shade" />
        </div>

        <div className="landing-hero-inner">
          <p
            id="landing-brand"
            className="landing-rise font-[family-name:var(--font-display)] text-[clamp(2.85rem,11vw,5.85rem)] font-semibold leading-[0.92] tracking-[0.08em] text-white"
          >
            LR Mastery
          </p>
          <h1
            className="landing-rise mt-5 max-w-xl font-[family-name:var(--font-display)] text-[clamp(1.35rem,3.2vw,1.9rem)] font-medium leading-snug tracking-tight text-white/90"
            style={{ animationDelay: "90ms" }}
          >
            Master English your way.
          </h1>
          <p
            className="landing-rise mt-3 max-w-md text-base leading-relaxed text-white/75 sm:text-lg"
            style={{ animationDelay: "160ms" }}
          >
            Pronunciation practice, vocabulary games, and your student desk —
            together.
          </p>
          <div
            className="landing-rise mt-8 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/login"
              className="touch-target inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#0d5c4d] transition hover:bg-white/90"
            >
              Enter Student Portal
            </Link>
            <Link
              href="/signup"
              className="touch-target inline-flex items-center justify-center rounded-xl border border-white/45 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/18"
            >
              Create account
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-paths" aria-labelledby="paths-heading">
        <div className="landing-paths-inner">
          <div className="landing-paths-copy">
            <h2
              id="paths-heading"
              className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              Choose how you practise
            </h2>
            <p className="mt-2 max-w-lg text-base text-muted">
              Pick a path and start where you are today.
            </p>

            <ul className="mt-8 grid list-none grid-cols-1 gap-0 divide-y divide-border border-y border-border p-0 md:grid-cols-3 md:divide-x md:divide-y-0">
              {practicePaths.map((path, index) => (
                <li key={path.href} className="min-w-0">
                  <Link
                    href={path.href}
                    className="landing-rise group flex h-full flex-col justify-between px-1 py-6 transition md:px-6 md:py-8 md:first:pl-0 md:last:pr-0"
                    style={{ animationDelay: `${320 + index * 90}ms` }}
                  >
                    <div>
                      <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                        {path.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                        {path.description}
                      </p>
                    </div>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-desk-accent transition group-hover:gap-2.5">
                      {path.cta}
                      <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <figure className="landing-secondary-media">
            <Image
              src="/marketing/practice-speaking.jpg"
              alt="Hands holding a microphone near an open notebook during speaking practice"
              width={1200}
              height={900}
              sizes="(max-width: 768px) 100vw, 42vw"
              className="landing-secondary-photo"
            />
          </figure>
        </div>
      </section>
    </>
  );
}
