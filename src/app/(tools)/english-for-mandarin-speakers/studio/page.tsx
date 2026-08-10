import type { Metadata } from "next";
import { AudioStudio } from "@/components/mandarin/AudioStudio";

export const metadata: Metadata = {
  title: "Audio Studio · English for Mandarin Speakers",
  description: "Password-protected draft audio verification for teachers.",
};

export default function MandarinStudioPage() {
  return <AudioStudio />;
}
