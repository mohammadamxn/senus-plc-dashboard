import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/modules/auth/session";
import { InviteForm } from "@/components/auth/invite-form";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminInvitePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.isAdmin) redirect("/reports/hy2026");

  return (
    <AdminShell
      currentPath="/admin/invite"
      title="Invite a user"
      description="Choose the role they&apos;ll have from the start — invited accounts never self-select their access level."
    >
      <div className="max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <InviteForm />
      </div>
    </AdminShell>
  );
}
