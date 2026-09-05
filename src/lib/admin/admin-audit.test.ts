import { describe, it, expect } from "vitest";
import { describeAuditEntry, type AdminAuditEntry } from "./admin-audit";

const base: AdminAuditEntry = {
  id: "1",
  actorEmail: "admin@example.com",
  action: "plan.change",
  targetEmail: "user@example.com",
  metadata: null,
  createdAt: "2026-07-13T00:00:00.000Z",
};

describe("describeAuditEntry", () => {
  it("renders a plan change with before/after", () => {
    expect(
      describeAuditEntry({ ...base, action: "plan.change", metadata: { from: "free", to: "pro" } })
    ).toBe("changed plan free → pro");
  });

  it("renders a quota reset, with and without a previous count", () => {
    expect(
      describeAuditEntry({ ...base, action: "quota.reset", metadata: { from: 7 } })
    ).toBe("reset AI-scan count (was 7)");
    expect(describeAuditEntry({ ...base, action: "quota.reset", metadata: null })).toBe(
      "reset AI-scan count"
    );
  });

  it("labels a null/blank custom limit as 'default'", () => {
    expect(
      describeAuditEntry({ ...base, action: "quota.limit", metadata: { from: null, to: 50 } })
    ).toBe("set custom scan limit default → 50");
    expect(
      describeAuditEntry({ ...base, action: "quota.limit", metadata: { from: 50, to: null } })
    ).toBe("set custom scan limit 50 → default");
  });

  it("renders ban / unban", () => {
    expect(describeAuditEntry({ ...base, action: "user.ban" })).toBe("banned the account");
    expect(describeAuditEntry({ ...base, action: "user.unban" })).toBe("unbanned the account");
  });

  it("renders admin role grant / revoke", () => {
    expect(describeAuditEntry({ ...base, action: "role.grant" })).toBe("granted admin access");
    expect(describeAuditEntry({ ...base, action: "role.revoke" })).toBe("revoked admin access");
  });

  it("renders review moderation with the rating that was moderated", () => {
    expect(
      describeAuditEntry({ ...base, action: "review.approve", metadata: { rating: 5 } })
    ).toBe("approved a 5-star review");
    expect(
      describeAuditEntry({ ...base, action: "review.reject", metadata: { rating: 1 } })
    ).toBe("rejected a 1-star review");
  });

  it("does not throw when review metadata is missing", () => {
    expect(describeAuditEntry({ ...base, action: "review.approve", metadata: null })).toBe(
      "approved a default-star review"
    );
  });

  it("falls back to the raw action slug for unknown actions", () => {
    expect(describeAuditEntry({ ...base, action: "future.thing" })).toBe("future.thing");
  });
});
