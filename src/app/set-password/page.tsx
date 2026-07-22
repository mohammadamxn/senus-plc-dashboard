import { redirect } from "next/navigation";

/** Compat for older invite emails that used next=/set-password. */
export default function SetPasswordRedirectPage() {
  redirect("/accept-invite");
}
