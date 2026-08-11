/** Text wordmark only — no shield/icon marks in banners. */
export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-[family-name:var(--font-display)] text-lg font-semibold tracking-[0.06em] sm:text-xl ${className}`}
    >
      LR Mastery
    </span>
  );
}
