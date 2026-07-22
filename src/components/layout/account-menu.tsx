"use client";

import Link from "next/link";
import { logout } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";

/**
 * Collapses personal account actions out of the report header toolbar.
 * Uses <details> so we don't need a separate dropdown dependency.
 */
export function AccountMenu({ email }: { email: string | null }) {
  return (
    <details className="group relative">
      <summary className="flex h-6 cursor-pointer list-none items-center gap-1 rounded-[min(var(--radius-md),10px)] border border-border bg-background px-2 text-xs font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
        Account
        <span className="text-muted-foreground" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-lg border border-border bg-background p-1 shadow-md">
        <p className="truncate px-2 py-1.5 text-[0.7rem] text-muted-foreground" title={email ?? undefined}>
          {email ?? "Signed in"}
        </p>
        <Link
          href="/account/password"
          className="block rounded-md px-2 py-1.5 text-xs hover:bg-muted"
        >
          Reset password
        </Link>
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="xs"
            className="h-auto w-full justify-start px-2 py-1.5 font-normal"
          >
            Sign out
          </Button>
        </form>
      </div>
    </details>
  );
}
