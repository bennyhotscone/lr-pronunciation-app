import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/portal-access";
import { ProfileEditor } from "@/components/portal/ProfileEditor";

export default async function ProfilePage() {
  const session = await requireRole("STUDENT");
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Your profile</h1>
      <p className="mt-2 text-muted">Choose a preferred name and avatar for My Desk.</p>
      <ProfileEditor
        preferredName={profile?.preferredName || session.user.preferredName || ""}
        avatarId={profile?.avatarId || session.user.avatarId || "fox"}
      />
    </div>
  );
}
