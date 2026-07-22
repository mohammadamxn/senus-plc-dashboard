// Deliberately its own module, not part of actions.ts: files with "use
// server" may only export async functions (each export becomes a server
// action reference), so a plain constant can't live there — it broke the
// whole module for every route that imports it. Both actions.ts (schema) and
// set-password-form.tsx (UI hint/minLength) import this instead.
//
// Mirrors the password strength policy configured in the Supabase Dashboard
// (Authentication > Policies > Password Requirements): min 8 chars, upper +
// lower case, a number, and a special character. Supabase doesn't expose
// that policy to the app at runtime, so if the Dashboard setting changes,
// update this value (and the regexes in actions.ts) to match.
export const PASSWORD_MIN_LENGTH = 8;
