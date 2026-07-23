"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!confirmRemove) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmRemove(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmRemove]);

  const dialog =
    confirmRemove && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="presentation"
            onClick={() => setConfirmRemove(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`delete-user-title-${userId}`}
              className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id={`delete-user-title-${userId}`} className="font-serif text-lg text-stone-900">
                Delete user?
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                Are you sure you want to delete this user ({email})? This cannot be undone.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={removePending}
                  onClick={() => setConfirmRemove(false)}
                >
                  Cancel
                </Button>
                <form action={removeAction}>
                  <input type="hidden" name="userId" value={userId} />
                  <Button type="submit" size="sm" variant="destructive" disabled={removePending || isSelf}>
                    {removePending ? "Deleting…" : "Yes, delete"}
                  </Button>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <tr className="border-b border-stone-100 last:border-0">
        <td className="py-3 pr-4 text-sm text-stone-900">
          {email}
          {isSelf && <span className="ml-1.5 text-xs text-stone-400">(you)</span>}
        </td>
        <td className="py-3 pr-4">
          {isAdmin ? (
            <span className="text-sm font-medium text-stone-900">Admin</span>
          ) : (
            <form action={audienceAction} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={userId} />
              <select
                key={audience ?? "none"}
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
                {audiencePending ? "Saving…" : "Save"}
              </Button>
            </form>
          )}
          {"error" in audienceState && audienceState.error && (
            <p className="mt-1 text-xs text-destructive">{audienceState.error}</p>
          )}
          {"success" in audienceState && audienceState.success && (
            <p className="mt-1 text-xs text-emerald-700">{audienceState.success}</p>
          )}
        </td>
        <td className="py-3 pr-4 text-right">
          <form action={adminAction}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="isAdmin" value={(!isAdmin).toString()} />
            <Button
              type="submit"
              size="xs"
              variant={isAdmin ? "destructive" : "outline"}
              disabled={adminPending || isSelf}
            >
              {isAdmin ? "Revoke admin" : "Make admin"}
            </Button>
          </form>
          {"error" in adminState && adminState.error && (
            <p className="mt-1 text-xs text-destructive">{adminState.error}</p>
          )}
        </td>
        <td className="py-3 text-right">
          <Button
            type="button"
            size="xs"
            variant="destructive"
            disabled={removePending || isSelf}
            onClick={() => setConfirmRemove(true)}
          >
            Remove
          </Button>
          {"error" in removeState && removeState.error && (
            <p className="mt-1 text-xs text-destructive">{removeState.error}</p>
          )}
          {"success" in removeState && removeState.success && (
            <p className="mt-1 text-xs text-stone-500">{removeState.success}</p>
          )}
        </td>
      </tr>
      {dialog}
    </>
  );
}
