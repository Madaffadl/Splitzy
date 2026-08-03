import { afterEach, describe, expect, it, vi } from "vitest";
import { flagEnvName, isServerEnabled } from "./flags";

// isEnabled (public flags) is resolved through a static map that the bundler
// inlines at build time, so it can't be toggled at runtime in a unit test.
// We cover the truthiness logic through the server-flag path (dynamic lookup)
// and assert the env-name mapping for both kinds.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isServerEnabled", () => {
  it("defaults to OFF when the env var is unset", () => {
    vi.stubEnv("FLAG_XENDIT_CHECKOUT", "");
    expect(isServerEnabled("xenditCheckout")).toBe(false);
  });

  it.each(["1", "true", "on", "yes", "TRUE", " On "])(
    "treats %j as enabled",
    (value) => {
      vi.stubEnv("FLAG_XENDIT_CHECKOUT", value);
      expect(isServerEnabled("xenditCheckout")).toBe(true);
    },
  );

  it.each(["0", "false", "off", "no", "", "maybe"])(
    "treats %j as disabled",
    (value) => {
      vi.stubEnv("FLAG_XENDIT_CHECKOUT", value);
      expect(isServerEnabled("xenditCheckout")).toBe(false);
    },
  );
});

describe("flagEnvName", () => {
  it("maps public flags to NEXT_PUBLIC_ vars", () => {
    expect(flagEnvName("dashboard")).toBe("NEXT_PUBLIC_FLAG_DASHBOARD");
  });

  it("maps server flags to FLAG_ vars", () => {
    expect(flagEnvName("xenditCheckout")).toBe("FLAG_XENDIT_CHECKOUT");
  });
});
