"use client";

import { useState, useTransition } from "react";
import { teacherUploadClassFile } from "@/lib/classroom-actions";
import { TagPicker } from "@/components/classroom/TagPicker";
import { MaterialKindPicker } from "@/components/classroom/MaterialKindPicker";

export function ClassFileUpload({
  classId,
  knownTags,
}: {
  classId: string;
  knownTags: string[];
}) {
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      action={(fd) => {
        setMsg(null);
        startTransition(async () => {
          const res = await teacherUploadClassFile(fd);
          if (res?.error) setMsg(res.error);
          else {
            setMsg("Uploaded.");
            setTitle("");
          }
        });
      }}
    >
      <input type="hidden" name="classId" value={classId} />
      <input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
      />
      <MaterialKindPicker defaultValue="INFO" idPrefix="class-file-upload" />
      <input name="file" type="file" required className="w-full text-sm" />
      <TagPicker classId={classId} knownTags={knownTags} title={title} body="" />
      <button type="submit" disabled={pending} className="btn-primary rounded px-3 py-2 text-sm font-bold disabled:opacity-50">
        Upload to classroom
      </button>
      {msg ? <p className="text-sm text-success">{msg}</p> : null}
    </form>
  );
}
