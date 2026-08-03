import { describe, expect, it } from "vitest";
import { extendProExpiry, isProActive } from "./entitlements";

const NOW = new Date("2026-08-03T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("isProActive", () => {
  it("is false for free users regardless of expiry", () => {
    expect(isProActive({ plan: "free", proExpiresAt: null }, NOW)).toBe(false);
    expect(
      isProActive({ plan: "free", proExpiresAt: new Date(NOW.getTime() + DAY) }, NOW)
    ).toBe(false);
  });

  it("treats pro with null expiry as active forever (comped/grandfathered)", () => {
    expect(isProActive({ plan: "pro", proExpiresAt: null }, NOW)).toBe(true);
  });

  it("is active when the pro expiry is in the future", () => {
    expect(
      isProActive({ plan: "pro", proExpiresAt: new Date(NOW.getTime() + DAY) }, NOW)
    ).toBe(true);
  });

  it("is expired (false) when the pro expiry is in the past", () => {
    expect(
      isProActive({ plan: "pro", proExpiresAt: new Date(NOW.getTime() - DAY) }, NOW)
    ).toBe(false);
  });
});

describe("extendProExpiry", () => {
  it("extends from now when not currently pro", () => {
    expect(extendProExpiry(null, 30, NOW).getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it("extends from now when the current period already lapsed", () => {
    const past = new Date(NOW.getTime() - 5 * DAY);
    expect(extendProExpiry(past, 30, NOW).getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it("stacks on top of remaining time when still active", () => {
    const future = new Date(NOW.getTime() + 10 * DAY);
    expect(extendProExpiry(future, 30, NOW).getTime()).toBe(future.getTime() + 30 * DAY);
  });
});
