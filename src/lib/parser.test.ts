import { describe, it, expect } from "vitest";
import { parseIndonesianPrice } from "./parser";

describe("parseIndonesianPrice", () => {
  it("parses plain thousand-separated amounts", () => {
    expect(parseIndonesianPrice("25.000")).toBe(25000);
    expect(parseIndonesianPrice("700.000")).toBe(700000);
    expect(parseIndonesianPrice("7.000.000")).toBe(7000000);
    expect(parseIndonesianPrice("1.500")).toBe(1500);
  });

  it("strips Rp prefix and currency symbols", () => {
    expect(parseIndonesianPrice("Rp 25.000")).toBe(25000);
    expect(parseIndonesianPrice("Rp25000")).toBe(25000);
  });

  it("handles comma as thousand separator", () => {
    expect(parseIndonesianPrice("25,000")).toBe(25000);
    expect(parseIndonesianPrice("1,234,567")).toBe(1234567);
  });

  // The reported bug: "700.000,00" / "700.000.00" (a price with trailing cents)
  // must be 700000, not 700 and not 70000000.
  it("handles a trailing decimal/cents part (Indonesian comma)", () => {
    expect(parseIndonesianPrice("700.000,00")).toBe(700000);
    expect(parseIndonesianPrice("25.000,50")).toBe(25000.5);
    expect(parseIndonesianPrice("1.234.567,89")).toBe(1234567.89);
  });

  it("handles a trailing decimal/cents part written with a dot", () => {
    expect(parseIndonesianPrice("700.000.00")).toBe(700000);
    expect(parseIndonesianPrice("7.000.00")).toBe(7000);
  });

  it("does not inflate or deflate by treating cents as thousands", () => {
    // 3 trailing digits ⇒ thousands group; 1-2 trailing digits ⇒ cents.
    expect(parseIndonesianPrice("700.000")).toBe(700000);
    expect(parseIndonesianPrice("700.00")).toBe(700);
  });

  it("returns 0 for junk", () => {
    expect(parseIndonesianPrice("abc")).toBe(0);
    expect(parseIndonesianPrice("")).toBe(0);
  });
});
