import { updatePassword } from "@/modules/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export default function UpdatePasswordPage() {
  return (
    <AuthCard title="Choose a new password" description="You're signed in via your reset link — set a new password below.">
      <SetPasswordForm action={updatePassword} submitLabel="Update password" />
    </AuthCard>
  );
}
