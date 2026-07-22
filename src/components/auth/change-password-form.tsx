"use client";

import { useActionState } from "react";
import Link from "next/link";
import { changePassword, type ActionResult } from "@/modules/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/modules/auth/password-policy";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

const initialState: ActionResult & { success?: string } = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  if (state.success) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-stone-700">{state.success}</p>
        <Button asChild variant="outline" className="h-9 w-full">
          <Link href={`/reports/${siteConfig.defaultPeriodId}`}>Back to report</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="currentPassword" className="text-xs font-medium text-stone-700">
          Current password
        </label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium text-stone-700">
          New password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
        />
        <p className="text-xs text-stone-500">
          At least {PASSWORD_MIN_LENGTH} characters, with upper, lower, a number, and a special
          character.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-xs font-medium text-stone-700">
          Confirm new password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="mt-2 h-9 w-full">
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
