import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/modules/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getDb } from "@/db/client";
import { profiles } from "@/db/schema";
import { UserRow } from "@/components/auth/user-row";
import { AdminShell } from "@/components/admin/admin-shell";
import type { AudienceId } from "@/config/site";

export default async function AdminUsersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.isAdmin) redirect("/reports/hy2026");

  const supabaseAdmin = createAdminSupabaseClient();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });

  const db = getDb();
  const profileRows = db ? await db.select().from(profiles) : [];
  const profileByUserId = new Map(profileRows.map((p) => [p.userId, p]));

  const users = (data?.users ?? [])
    .map((u) => ({
      userId: u.id,
      email: u.email ?? "(no email)",
      audience: (profileByUserId.get(u.id)?.audience as AudienceId | null) ?? null,
      isAdmin: profileByUserId.get(u.id)?.isAdmin ?? false,
      createdAt: u.created_at,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return (
    <AdminShell
      currentPath="/admin/users"
      title="Users"
      description="Change a user&apos;s role or admin status. Every change is written to the audit log."
    >
      {error && <p className="mb-4 text-sm text-destructive">Could not load users: {error.message}</p>}

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 text-right">Admin</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.userId}
                userId={u.userId}
                email={u.email}
                audience={u.audience}
                isAdmin={u.isAdmin}
                isSelf={u.userId === profile.userId}
              />
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="py-6 text-center text-sm text-stone-500">No users yet.</p>}
      </div>
    </AdminShell>
  );
}
