"use server";

import "server-only";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/navigation";
import { getDb } from "@/db/client";
import { profiles, auditLog } from "@/db/schema";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/modules/auth/session";
import { siteConfig, type AudienceId } from "@/config/site";

export type AdminActionResult = { error: string } | { success: string };

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.isAdmin) {
    throw new Error("Forbidden: admin only");
  }
  return profile;
}

async function writeAuditLog(
  actorUserId: string,
  action: string,
  targetUserId: string | null,
  metadata: Record<string, unknown>,
) {
  const db = getDb();
  if (!db) return;
  await db.insert(auditLog).values({ actorUserId, action, targetUserId, metadata });
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  audience: z.enum(siteConfig.audiences.map((a) => a.id) as [AudienceId, ...AudienceId[]]),
});

/**
 * Admin-only: invite a new user with a role fixed by the admin (never
 * something the invitee controls). Re-verifies is_admin server-side (never
 * trust a hidden button) and writes every outcome (sent or failed) to audit_log.
 */
export async function sendInvite(
  _prevState: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    audience: formData.get("audience"),
  });
  if (!parsed.success) return { error: "Enter a valid email and select a role." };
  const { email, audience } = parsed.data;

  const supabaseAdmin = createAdminSupabaseClient();
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { audience, is_admin: false },
  });

  if (error) {
    await writeAuditLog(admin.userId, "invite_failed", null, { email, audience, message: error.message });
    return { error: "Could not send invite. The address may already be registered." };
  }

  await writeAuditLog(admin.userId, "invite_sent", null, { email, audience });
  return { success: `Invite sent to ${email}.` };
}

const assignAudienceSchema = z.object({
  userId: z.string().uuid(),
  audience: z.enum(siteConfig.audiences.map((a) => a.id) as [AudienceId, ...AudienceId[]]),
});

/** Admin-only: change an existing user's audience/role. */
export async function assignAudience(
  _prevState: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const parsed = assignAudienceSchema.safeParse({
    userId: formData.get("userId"),
    audience: formData.get("audience"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const db = getDb();
  if (!db) return { error: "Database unavailable." };

  await db
    .update(profiles)
    .set({ audience: parsed.data.audience })
    .where(eq(profiles.userId, parsed.data.userId));

  await writeAuditLog(admin.userId, "audience_changed", parsed.data.userId, {
    audience: parsed.data.audience,
  });
  return { success: "Role updated." };
}

const setAdminSchema = z.object({
  userId: z.string().uuid(),
  isAdmin: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/** Admin-only: grant or revoke admin. Guards against an admin revoking their own last-admin status by mistake is intentionally NOT enforced here — a small platform with one admin table doesn't need that complexity; audit_log gives full traceability instead. */
export async function setAdmin(
  _prevState: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const parsed = setAdminSchema.safeParse({
    userId: formData.get("userId"),
    isAdmin: formData.get("isAdmin"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const db = getDb();
  if (!db) return { error: "Database unavailable." };

  await db.update(profiles).set({ isAdmin: parsed.data.isAdmin }).where(eq(profiles.userId, parsed.data.userId));

  await writeAuditLog(admin.userId, parsed.data.isAdmin ? "admin_granted" : "admin_revoked", parsed.data.userId, {});
  return { success: "Admin status updated." };
}

const removeUserSchema = z.object({
  userId: z.string().uuid(),
});

/** Admin-only: delete an Auth user and their profile. Cannot remove yourself. */
export async function removeUser(
  _prevState: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const parsed = removeUserSchema.safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  if (parsed.data.userId === admin.userId) {
    return { error: "You cannot remove your own account." };
  }

  const supabaseAdmin = createAdminSupabaseClient();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(parsed.data.userId);
  if (error) {
    await writeAuditLog(admin.userId, "user_remove_failed", parsed.data.userId, {
      message: error.message,
    });
    return { error: "Could not remove user." };
  }

  const db = getDb();
  if (db) {
    await db.delete(profiles).where(eq(profiles.userId, parsed.data.userId));
  }

  await writeAuditLog(admin.userId, "user_removed", parsed.data.userId, {});
  revalidatePath("/admin/users");
  return { success: "User removed." };
}
