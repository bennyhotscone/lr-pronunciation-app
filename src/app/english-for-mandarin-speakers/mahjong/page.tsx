import type { Metadata } from "next";
import { MahjongMatch } from "@/components/mandarin/MahjongMatch";

export const metadata: Metadata = {
  title: "Mahjong Solitaire · English for Mandarin Speakers",
  description:
    "Classic Mahjong Solitaire: match English ↔ 中文 or Audio ↔ 中文 on a stacked tile board. Remix when stuck.",
};

export default function MandarinMahjongPage() {
  return <MahjongMatch />;
}
