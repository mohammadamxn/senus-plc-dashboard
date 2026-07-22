import { acceptInvite } from "@/modules/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export default function AcceptInvitePage() {
  return (
    <AuthCard title="Set your password" description="Welcome — set a password to finish creating your account.">
      <SetPasswordForm action={acceptInvite} submitLabel="Set password and continue" />
    </AuthCard>
  );
}
