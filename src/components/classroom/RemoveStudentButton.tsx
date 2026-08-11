"use client";

import { useTransition } from "react";
import { teacherRemoveStudentFromClass } from "@/lib/classroom-actions";

export function RemoveStudentButton({
  classId,
  studentId,
  label,
}: {
  classId: string;
  studentId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs font-semibold text-muted underline-offset-2 hover:text-danger hover:underline disabled:opacity-50"
      onClick={() => {
        if (!window.confirm(`Remove ${label} from this classroom?`)) return;
        const fd = new FormData();
        fd.set("classId", classId);
        fd.set("studentId", studentId);
        startTransition(async () => {
          await teacherRemoveStudentFromClass(fd);
        });
      }}
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
