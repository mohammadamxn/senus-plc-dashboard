"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type ActionResult } from "@/modules/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: ActionResult = {};

export function LoginForm({ linkExpired }: { linkExpired?: boolean }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <AuthCard
      title="Sign in"
      description="Board reports for management, the board, and invited investors."
      footer={
        <Link href="/forgot-password" className="underline underline-offset-4 hover:text-stone-900">
          Forgot your password?
        </Link>
      }
    >
      {linkExpired && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          That link has expired or was already used. Sign in, or request a new reset link.
        </p>
      )}
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-stone-700">
            Email
          </label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-stone-700">
            Password
          </label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className="mt-2 h-9 w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-stone-500">
        Accounts are created by invitation only. Contact an admin if you need access.
      </p>
    </AuthCard>
  );
}
