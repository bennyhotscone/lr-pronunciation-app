export function ClassMoneyBadge({ balance }: { balance: number }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-xl border border-[#c9b89a] bg-[#f7f1df] px-3 py-1.5 shadow-sm"
      title="Class money — only teachers award money"
    >
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-desk-accent">
        Class money
      </span>
      <span className="font-[family-name:var(--font-display)] text-xl font-bold tabular-nums leading-none text-[#1f4e46]">
        ${balance}
      </span>
    </div>
  );
}
