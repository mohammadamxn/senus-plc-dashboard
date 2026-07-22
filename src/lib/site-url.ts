/**
 * Canonical public origin for auth email links (invite / password reset).
 * Server Actions have no Host header — never guess production as localhost.
 */
export function getSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set in production so invite and password-reset emails do not point at localhost.",
    );
  }
  return "http://localhost:3000";
}

export function inviteConfirmUrl(): string {
  return `${getSiteOrigin()}/auth/confirm?type=invite&next=/accept-invite`;
}

export function recoveryConfirmUrl(): string {
  return `${getSiteOrigin()}/auth/confirm?type=recovery&next=/update-password`;
}
