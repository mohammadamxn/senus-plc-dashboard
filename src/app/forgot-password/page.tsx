"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/modules/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: { error?: string; success?: string } = {};

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email you sign in with and we'll send you a reset link."
      footer={
        <Link href="/login" className="underline underline-offset-4 hover:text-stone-900">
          Back to sign in
        </Link>
      }
    >
      {state.success ? (
        <p className="text-sm text-stone-700">{state.success}</p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-stone-700">
              Email
            </label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="mt-2 h-9 w-full">
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
