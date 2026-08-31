import Link from "next/link";
import { JapaneseLearningApp } from "@/components/japanese/JapaneseLearningApp";

export default function LearnJapanesePage() {
  return (
    <div>
      <Link href="/portal" className="text-sm font-bold text-desk-accent hover:underline">
        Back to My Desk
      </Link>
      <div className="mt-4">
        <JapaneseLearningApp />
      </div>
    </div>
  );
}
