import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { siteConfig } from "@/config/site";

export default function AccountPasswordPage() {
  return (
    <AuthCard
      title="Change your password"
      description="Enter your current password, then choose a new one."
      footer={
        <Link
          href={`/reports/${siteConfig.defaultPeriodId}`}
          className="underline underline-offset-4 hover:text-stone-900"
        >
          Back to report
        </Link>
      }
    >
      <ChangePasswordForm />
    </AuthCard>
  );
}
