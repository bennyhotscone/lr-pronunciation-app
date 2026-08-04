import type { Metadata } from "next";
import { MahjongMatch } from "@/components/mandarin/MahjongMatch";

export const metadata: Metadata = {
  title: "Mahjong Solitaire · English for Mandarin Speakers",
  description:
    "Classic Mahjong Solitaire: match English words with Mandarin glosses on a stacked tile board.",
};

export default function MandarinMahjongPage() {
  return <MahjongMatch />;
}
