import { describe, it, expect } from "vitest";
import { hasPaymentInfo, normalizePaymentInfo, formatPaymentInfoText } from "./payment-info";

describe("hasPaymentInfo", () => {
  it("is false for null/undefined and all-empty", () => {
    expect(hasPaymentInfo(undefined)).toBe(false);
    expect(hasPaymentInfo(null)).toBe(false);
    expect(hasPaymentInfo({})).toBe(false);
    expect(hasPaymentInfo({ bank: "  ", accountNumber: "" })).toBe(false);
  });

  it("is true when any field has content", () => {
    expect(hasPaymentInfo({ accountNumber: "123" })).toBe(true);
    expect(hasPaymentInfo({ bank: "BCA" })).toBe(true);
  });
});

describe("normalizePaymentInfo", () => {
  it("trims fields and returns undefined when everything is empty", () => {
    expect(normalizePaymentInfo({ bank: "  ", accountNumber: " " })).toBeUndefined();
    expect(normalizePaymentInfo(undefined)).toBeUndefined();
  });

  it("trims and keeps only non-empty fields", () => {
    expect(
      normalizePaymentInfo({ bank: " BCA ", accountNumber: " 123 ", accountName: "" })
    ).toEqual({ bank: "BCA", accountNumber: "123", accountName: undefined });
  });
});

describe("formatPaymentInfoText", () => {
  it("returns null when there is nothing to show", () => {
    expect(formatPaymentInfoText(undefined)).toBeNull();
    expect(formatPaymentInfoText({})).toBeNull();
  });

  it("joins present fields with a separator", () => {
    expect(
      formatPaymentInfoText({ bank: "BCA", accountNumber: "1234567890", accountName: "Alex" })
    ).toBe("BCA · 1234567890 · Alex");
  });

  it("skips missing fields", () => {
    expect(formatPaymentInfoText({ accountNumber: "1234567890" })).toBe("1234567890");
    expect(formatPaymentInfoText({ bank: "GoPay", accountName: "Bella" })).toBe(
      "GoPay · Bella"
    );
  });
});
