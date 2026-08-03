import { afterEach, describe, expect, it, vi } from "vitest";

// admin-auth reads ADMIN_BOOTSTRAP_EMAILS once at module load, so each test
// stubs the env then re-imports the module through a fresh registry.
async function loadWith(bootstrap: string | undefined) {
  vi.resetModules();
  if (bootstrap === undefined) vi.stubEnv("ADMIN_BOOTSTRAP_EMAILS", "");
  else vi.stubEnv("ADMIN_BOOTSTRAP_EMAILS", bootstrap);
  return import("./admin-auth");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isBootstrapAdmin", () => {
  it("no email is hardcoded — empty env means no bootstrap admins", async () => {
    const { isBootstrapAdmin } = await loadWith(undefined);
    expect(isBootstrapAdmin("m.daffafadhil26@gmail.com")).toBe(false);
    expect(isBootstrapAdmin("anyone@example.com")).toBe(false);
  });

  it("treats configured emails as bootstrap admins (case/space-insensitive)", async () => {
    const { isBootstrapAdmin } = await loadWith("owner@example.com, Two@Example.com");
    expect(isBootstrapAdmin("owner@example.com")).toBe(true);
    expect(isBootstrapAdmin("  TWO@example.com ")).toBe(true);
    expect(isBootstrapAdmin("stranger@example.com")).toBe(false);
  });
});

describe("isAdmin", () => {
  it("grants admin via DB role even with an empty bootstrap list", async () => {
    const { isAdmin } = await loadWith(undefined);
    expect(isAdmin({ email: "u@example.com", role: "admin" })).toBe(true);
    expect(isAdmin({ email: "u@example.com", role: "user" })).toBe(false);
  });

  it("grants admin via bootstrap email regardless of DB role", async () => {
    const { isAdmin } = await loadWith("owner@example.com");
    expect(isAdmin({ email: "owner@example.com", role: "user" })).toBe(true);
  });
});
