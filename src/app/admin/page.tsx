import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/modules/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";

const CARDS = [
  {
    href: "/admin/ingest",
    title: "Ingest PDF",
    body: "Upload financial or reference documents for a period, review drafts, and approve into the live pack.",
  },
  {
    href: "/admin/users",
    title: "Manage users",
    body: "Change roles and admin status. Every change is written to the audit log.",
  },
  {
    href: "/admin/invite",
    title: "Invite user",
    body: "Send an invite with a fixed audience — invitees never self-select their access level.",
  },
] as const;

export default async function AdminHomePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.isAdmin) redirect("/reports/hy2026");

  return (
    <AdminShell
      currentPath="/admin"
      title="Admin"
      description="Operations for the board report pack — documents, users, and invites."
    >
      <ul className="grid gap-3 sm:grid-cols-1">
        {CARDS.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="block rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50"
            >
              <h2 className="font-serif text-lg tracking-tight text-stone-900">{card.title}</h2>
              <p className="mt-1.5 text-sm text-stone-600">{card.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
