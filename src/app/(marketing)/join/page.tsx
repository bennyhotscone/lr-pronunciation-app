import type { Metadata } from "next";
import Link from "next/link";
import { JoinCodeForm } from "@/components/classroom/JoinCodeForm";

export const metadata: Metadata = {
  title: "Join with code",
};

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-md pt-16">
      <p className="chip bg-teal/20">Student</p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">
        Join a classroom
      </h1>
      <p className="mt-2 text-muted">
        Enter the invite code from your teacher. Sign up first if you don&apos;t have an account.
      </p>
      <JoinCodeForm />
      <p className="mt-6 text-sm text-muted">
        <Link href="/signup" className="font-semibold underline-offset-2 hover:underline">
          Sign up
        </Link>
        {" · "}
        <Link href="/login" className="font-semibold underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
