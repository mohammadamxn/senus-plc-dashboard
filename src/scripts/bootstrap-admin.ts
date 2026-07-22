/**
 * One-time bootstrap for the very first admin. Accounts are invite-only —
 * nobody can self-signup — so there's a chicken-and-egg problem at initial
 * setup: no admin exists yet to send the first invite from /admin/invite.
 * This script calls the same Supabase invite API directly with the
 * service-role key, run once by hand from the CLI.
 *
 * Usage: npm run bootstrap-admin -- you@example.com
 *
 * Every subsequent admin should be invited normally, by an existing admin,
 * through /admin/invite — not by re-running this script.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { inviteConfirmUrl } from "@/lib/site-url";

async function main() {
  const email = process.argv[2];
  const parsed = z.string().trim().email().safeParse(email);
  if (!parsed.success) {
    console.error("Usage: npm run bootstrap-admin -- you@example.com");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  }

  const supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(parsed.data, {
    data: { audience: "management", is_admin: true },
    redirectTo: inviteConfirmUrl(),
  });

  if (error) {
    console.error("Failed to invite first admin:", error.message);
    process.exit(1);
  }

  console.log(`Invited ${data.user.email} as the first admin (management, is_admin: true).`);
  console.log("They'll receive an email to set their password via /accept-invite.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
