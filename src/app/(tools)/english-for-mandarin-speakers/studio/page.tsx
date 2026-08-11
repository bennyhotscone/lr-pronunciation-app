import type { Metadata } from "next";
import { AudioStudio } from "@/components/mandarin/AudioStudio";
import { requireAdmin } from "@/lib/portal-access";

export const metadata: Metadata = {
  title: "Audio Studio · English for Mandarin Speakers",
  description: "Admin-only permanent audio overrides for Mandarin vocabulary.",
};

export default async function MandarinStudioPage() {
  await requireAdmin();
  return <AudioStudio />;
}
