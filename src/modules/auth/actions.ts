"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PASSWORD_MIN_LENGTH } from "@/modules/auth/password-policy";
import { recoveryConfirmUrl } from "@/lib/site-url";

export type ActionResult = { error: string } | { error?: undefined };

// Generic, non-enumerating message: whether the email doesn't exist, was
// never invited, or the password is simply wrong, the caller can't tell
// which — that distinction is exactly what would let someone probe for
// valid invited emails.
const GENERIC_LOGIN_ERROR = "Invalid email or password.";
const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function login(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC_LOGIN_ERROR };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: GENERIC_LOGIN_ERROR };

  redirect("/reports/hy2026");
}

export async function logout(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const emailSchema = z.object({ email: z.string().trim().email() });

export async function requestPasswordReset(
  _prevState: ActionResult & { success?: string },
  formData: FormData,
): Promise<ActionResult & { success?: string }> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  // Always the same outcome regardless of validation/lookup result —
  // anti-enumeration applies to the client-visible response, not just the
  // Supabase call itself.
  if (!parsed.success) return { success: GENERIC_RESET_MESSAGE };

  const supabase = await createServerSupabaseClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: recoveryConfirmUrl(),
  });

  return { success: GENERIC_RESET_MESSAGE };
}

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
      .regex(/[a-z]/, "Password must include a lowercase letter.")
      .regex(/[A-Z]/, "Password must include an uppercase letter.")
      .regex(/[0-9]/, "Password must include a number.")
      .regex(/[^a-zA-Z0-9]/, "Password must include a special character."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

async function setPassword(formData: FormData): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  const supabase = await createServerSupabaseClient();
  // Requires an active session — only reachable after /auth/confirm has
  // exchanged an invite/reset token for one. Re-verified here rather than
  // trusted from the client.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your invite or reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Could not set password. Please try again." };

  return {};
}

export async function acceptInvite(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const result = await setPassword(formData);
  if (result.error) return result;
  redirect("/reports/hy2026");
}

export async function updatePassword(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const result = await setPassword(formData);
  if (result.error) return result;
  redirect("/reports/hy2026");
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
      .regex(/[a-z]/, "Password must include a lowercase letter.")
      .regex(/[A-Z]/, "Password must include an uppercase letter.")
      .regex(/[0-9]/, "Password must include a number.")
      .regex(/[^a-zA-Z0-9]/, "Password must include a special character."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: "New password must be different from your current password.",
    path: ["password"],
  });

/**
 * Logged-in password change: re-verify current password, then update.
 * Distinct from recovery `/update-password`, which has no current-password step.
 */
export async function changePassword(
  _prevState: ActionResult & { success?: string },
  formData: FormData,
): Promise<ActionResult & { success?: string }> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "You must be signed in to change your password." };

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (reauthError) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Could not update password. Please try again." };

  return { success: "Your password has been updated." };
}
