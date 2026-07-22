import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/modules/auth/session", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: vi.fn() }));

const valuesMock = vi.fn().mockResolvedValue(undefined);
const whereMock = vi.fn().mockResolvedValue(undefined);
const insertMock = vi.fn(() => ({ values: valuesMock }));
const updateMock = vi.fn(() => ({ set: vi.fn(() => ({ where: whereMock })) }));
vi.mock("@/db/client", () => ({ getDb: () => ({ insert: insertMock, update: updateMock }) }));

import { getCurrentProfile } from "@/modules/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendInvite, assignAudience, setAdmin, type AdminActionResult } from "@/modules/auth/admin-actions";

const initialState: AdminActionResult = { success: "" };

const ADMIN_USER_ID = "11111111-1111-4111-a111-111111111111";
const NON_ADMIN_USER_ID = "22222222-2222-4222-a222-222222222222";
const TARGET_USER_ID = "33333333-3333-4333-a333-333333333333";

const ADMIN_PROFILE = {
  userId: ADMIN_USER_ID,
  email: "admin@example.com",
  audience: "management" as const,
  isAdmin: true,
  fullName: null,
};

const NON_ADMIN_PROFILE = {
  ...ADMIN_PROFILE,
  userId: NON_ADMIN_USER_ID,
  isAdmin: false,
};

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.mocked(createAdminSupabaseClient).mockReturnValue({
    auth: { admin: { inviteUserByEmail: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }) } },
  } as never);
  insertMock.mockClear();
  updateMock.mockClear();
  valuesMock.mockClear();
  whereMock.mockClear();
});

describe("admin-actions authorization", () => {
  it("sendInvite is forbidden for a non-admin", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(NON_ADMIN_PROFILE);
    const result = await sendInvite(initialState, formData({ email: "new@example.com", audience: "credit" }));
    expect(result).toEqual({ error: "Forbidden." });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("assignAudience is forbidden for a non-admin", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(NON_ADMIN_PROFILE);
    const result = await assignAudience(initialState, formData({ userId: TARGET_USER_ID, audience: "board" }));
    expect(result).toEqual({ error: "Forbidden." });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("setAdmin is forbidden for a non-admin", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(NON_ADMIN_PROFILE);
    const result = await setAdmin(initialState, formData({ userId: TARGET_USER_ID, isAdmin: "true" }));
    expect(result).toEqual({ error: "Forbidden." });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sendInvite succeeds for an admin and writes an audit_log row", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(ADMIN_PROFILE);
    const result = await sendInvite(initialState, formData({ email: "new@example.com", audience: "credit" }));
    expect(result).toEqual({ success: "Invite sent to new@example.com." });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invite_sent", actorUserId: ADMIN_PROFILE.userId }),
    );
  });

  it("assignAudience succeeds for an admin and writes an audit_log row", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(ADMIN_PROFILE);
    const result = await assignAudience(initialState, formData({ userId: TARGET_USER_ID, audience: "equity" }));
    expect(result).toEqual({ success: "Role updated." });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({ action: "audience_changed" }));
  });

  it("setAdmin succeeds for an admin and writes an audit_log row", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(ADMIN_PROFILE);
    const result = await setAdmin(initialState, formData({ userId: TARGET_USER_ID, isAdmin: "true" }));
    expect(result).toEqual({ success: "Admin status updated." });
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({ action: "admin_granted" }));
  });
});
