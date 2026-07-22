"use client";

import { useActionState } from "react";
import { sendInvite, type AdminActionResult } from "@/modules/auth/admin-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

const initialState: AdminActionResult = { success: "" };

export function InviteForm() {
  const [state, formAction, pending] = useActionState(sendInvite, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-stone-700">
          Email
        </label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="audience" className="text-xs font-medium text-stone-700">
          Role
        </label>
        <select
          id="audience"
          name="audience"
          required
          defaultValue="board"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {siteConfig.audiences.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      {"error" in state && state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {"success" in state && state.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      <Button type="submit" disabled={pending} className="mt-2 h-9 w-full">
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
