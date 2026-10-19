import type { Metadata } from "next";
import { LantitePractice } from "@/components/lantite/LantitePractice";
import "./lantite.css";

export const metadata: Metadata = {
  title: "LANTITE Literacy Practice",
  description:
    "Independent LANTITE-style literacy practice for reading and writing conventions. Not affiliated with or endorsed by ACER. No account required. Answers stay in this browser.",
};

export default function LantitePage() {
  return <LantitePractice />;
}
