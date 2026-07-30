import { describe, it, expect } from "vitest";
import { parseBeacon, describeActivity, featureLabel } from "./activity";

describe("parseBeacon", () => {
  it("accepts an allowed feature + type", () => {
    expect(parseBeacon({ feature: "single", type: "split.created" })).toEqual({
      feature: "single",
      type: "split.created",
    });
  });

  it("rejects a non-beacon feature (account/login is server-only)", () => {
    expect(parseBeacon({ feature: "account", type: "login" })).toBeNull();
  });

  it("rejects an unknown type", () => {
    expect(parseBeacon({ feature: "travel", type: "hacked" })).toBeNull();
  });

  it("rejects malformed bodies", () => {
    expect(parseBeacon(null)).toBeNull();
    expect(parseBeacon("nope")).toBeNull();
    expect(parseBeacon({ feature: 1, type: 2 })).toBeNull();
    expect(parseBeacon({ feature: "single" })).toBeNull();
  });
});

describe("describeActivity", () => {
  const entry = (over: Partial<Parameters<typeof describeActivity>[0]>) =>
    describeActivity({ id: "x", userEmail: "a@b.c", feature: "single", type: "split.created", metadata: null, createdAt: "", ...over });

  it("describes a login", () => {
    expect(entry({ feature: "account", type: "login" })).toBe("signed in");
  });

  it("describes a feature split with a human label", () => {
    expect(entry({ feature: "travel", type: "split.created" })).toBe("created a split in Travel Spend");
  });

  it("falls back for unknown types", () => {
    expect(entry({ feature: "multiple", type: "weird.thing" })).toBe("weird.thing · Multiple receipts");
  });
});

describe("featureLabel", () => {
  it("maps known features", () => {
    expect(featureLabel("single")).toBe("Single receipt");
    expect(featureLabel("travel")).toBe("Travel Spend");
  });
  it("passes through unknown features", () => {
    expect(featureLabel("mystery")).toBe("mystery");
  });
});
