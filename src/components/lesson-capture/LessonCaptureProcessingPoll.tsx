"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LessonCaptureProcessingPoll({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [router, sessionId]);

  return (
    <div className="board-panel mt-6 rounded-xl p-6 text-sm text-chalk/70">
      <p className="animate-pulse font-semibold text-chalk">Working on your lesson…</p>
      <p className="mt-2 text-xs text-chalk/50">Session ID: {sessionId}</p>
    </div>
  );
}
