export function ClassMoneyBadge({ balance }: { balance: number }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-xl border border-desk-accent/30 bg-white/90 px-3 py-1.5 text-sm font-bold text-ink shadow-sm"
      title="Class money — ask your teacher in person about rewards"
    >
      <span className="text-xs font-bold uppercase tracking-wide text-desk-accent">Class money</span>
      <span className="tabular-nums">{balance}</span>
    </div>
  );
}