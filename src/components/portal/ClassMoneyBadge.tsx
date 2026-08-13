import { MOCKUP_UI } from "@/lib/mockup-ui";

export function ClassMoneyBadge({ balance }: { balance: number }) {
  return (
    <div
      className="mockup-chrome relative inline-block w-[11.5rem] shrink-0 overflow-hidden rounded-xl shadow-sm sm:w-[13rem]"
      title="Class money — only teachers award money"
    >
      <img
        src={MOCKUP_UI.walletChip}
        alt=""
        className="mockup-img block w-full"
        width={1320}
        height={780}
        decoding="async"
      />
      <div className="absolute inset-[18%_22%_38%_22%] flex flex-col items-center justify-center rounded-md bg-[#f7f1df]/92 text-center">
        <p className="text-[0.6rem] font-bold uppercase tracking-wide text-desk-accent">Class money</p>
        <p className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums leading-none text-[#1f4e46] sm:text-3xl">
          {balance}
        </p>
      </div>
    </div>
  );
}