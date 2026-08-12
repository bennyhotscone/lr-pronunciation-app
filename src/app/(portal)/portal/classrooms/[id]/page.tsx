import { notFound, redirect } from "next/navigation";
import { requireRole, studentCanAccessClass } from "@/lib/portal-access";

/** Legacy classroom URL — students use My Desk as the single class surface. */
export default async function StudentClassroomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tag?: string; tab?: string; day?: string }>;
}) {
  const session = await requireRole("STUDENT");
  const { id } = await params;
  const sp = await searchParams;

  const allowed = await studentCanAccessClass(session.user.id, id);
  if (!allowed) notFound();

  const qs = new URLSearchParams();
  if (sp.tag) qs.set("tag", sp.tag);
  if (sp.tab) qs.set("tab", sp.tab);
  if (sp.day) qs.set("day", sp.day);
  const q = qs.toString();
  redirect(q ? `/portal?${q}` : "/portal");
}
