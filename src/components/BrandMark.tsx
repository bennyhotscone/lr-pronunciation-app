/** Original viking-inspired LR mark — shield + prow hint. Not a third-party logo. */
export function BrandMark({
  size = 40,
  className = "",
  title = "LR Mastery",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Shield body */}
      <path
        d="M32 4L54 14v18c0 14.5-9.2 24.8-22 28-12.8-3.2-22-13.5-22-28V14L32 4z"
        fill="url(#lr-shield)"
        stroke="#c4a574"
        strokeWidth="1.5"
      />
      {/* Prow / keel line */}
      <path
        d="M32 10v42"
        stroke="#8b7355"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Rune-like LR */}
      <path
        d="M22 24h8.5c4.2 0 7 2.2 7 5.6 0 2.6-1.5 4.5-4 5.3L38 44h-4.2l-4.1-8.2H26V44h-4V24zm4 3.2v6.2h4.2c2.1 0 3.3-1 3.3-3.1s-1.2-3.1-3.3-3.1H26z"
        fill="#f0e6d4"
      />
      <path
        d="M40 24h3.8l6.8 11.2V24H54v20h-3.8L43.4 32.8V44H40V24z"
        fill="#e8d5b5"
      />
      <defs>
        <linearGradient id="lr-shield" x1="12" y1="6" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3a342c" />
          <stop offset="0.55" stopColor="#2a2520" />
          <stop offset="1" stopColor="#1a1714" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark size={32} />
      <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[0.08em] text-foreground sm:text-xl">
        LR MASTERY
      </span>
    </span>
  );
}
