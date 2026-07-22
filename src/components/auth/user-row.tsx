"use client";

import { useActionState } from "react";
import {
  assignAudience,
  setAdmin,
  removeUser,
  type AdminActionResult,
} from "@/modules/auth/admin-actions";
import { Button } from "@/components/ui/button";
import { siteConfig, type AudienceId } from "@/config/site";

const initialState: AdminActionResult = { success: "" };

export function UserRow({
  userId,
  email,
  audience,
  isAdmin,
  isSelf,
}: {
  userId: string;
  email: string;
  audience: AudienceId | null;
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const [audienceState, audienceAction, audiencePending] = useActionState(assignAudience, initialState);
  const [adminState, adminAction, adminPending] = useActionState(setAdmin, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeUser, initialState);

  return (
    <tr className="border-b border-stone-100 last:border-0">
      <td className="py-3 pr-4 text-sm text-stone-900">
        {email}
        {isSelf && <span className="ml-1.5 text-xs text-stone-400">(you)</span>}
      </td>
      <td className="py-3 pr-4">
        <form action={audienceAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <select
            name="audience"
            defaultValue={audience ?? ""}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
          >
            <option value="" disabled>
              No role
            </option>
            {siteConfig.audiences.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="xs" variant="outline" disabled={audiencePending}>
            Save
          </Button>
        </form>
        {"error" in audienceState && audienceState.error && (
          <p className="mt-1 text-xs text-destructive">{audienceState.error}</p>
        )}
      </td>
      <td className="py-3 pr-4 text-right">
        <form action={adminAction}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="isAdmin" value={(!isAdmin).toString()} />
          <Button type="submit" size="xs" variant={isAdmin ? "destructive" : "outline"} disabled={adminPending || isSelf}>
            {isAdmin ? "Revoke admin" : "Make admin"}
          </Button>
        </form>
        {"error" in adminState && adminState.error && (
          <p className="mt-1 text-xs text-destructive">{adminState.error}</p>
        )}
      </td>
      <td className="py-3 text-right">
        <form
          action={removeAction}
          onSubmit={(e) => {
            if (!confirm(`Remove ${email}? This cannot be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="userId" value={userId} />
          <Button type="submit" size="xs" variant="destructive" disabled={removePending || isSelf}>
            {removePending ? "Removing…" : "Remove"}
          </Button>
        </form>
        {"error" in removeState && removeState.error && (
          <p className="mt-1 text-xs text-destructive">{removeState.error}</p>
        )}
        {"success" in removeState && removeState.success && (
          <p className="mt-1 text-xs text-stone-500">{removeState.success}</p>
        )}
      </td>
    </tr>
  );
}
