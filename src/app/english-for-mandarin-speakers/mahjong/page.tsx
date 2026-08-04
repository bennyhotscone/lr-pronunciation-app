import type { Metadata } from "next";
import { MahjongMatch } from "@/components/mandarin/MahjongMatch";

export const metadata: Metadata = {
  title: "Mahjong Match · English for Mandarin Speakers",
  description:
    "Match English audio or words with Mandarin meanings on a mahjong-style board.",
};

export default function MandarinMahjongPage() {
  return <MahjongMatch />;
}
