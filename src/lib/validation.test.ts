import { describe, it, expect } from "vitest";
import {
  validateTripCreate,
  validateTripPatch,
  validateReceiptCreate,
  validateReceiptPatch,
  validateMemberAdd,
  ValidationError,
  isUuid,
} from "./validation";

describe("validateTripCreate", () => {
  it("accepts a trimmed name", () => {
    expect(validateTripCreate({ name: "  Beach Trip  " })).toEqual({
      name: "Beach Trip",
    });
  });

  it("rejects an empty / whitespace-only name", () => {
    expect(() => validateTripCreate({ name: "" })).toThrow(ValidationError);
    expect(() => validateTripCreate({ name: "   " })).toThrow(ValidationError);
  });

  it("rejects a non-string name", () => {
    expect(() => validateTripCreate({ name: 123 })).toThrow(ValidationError);
    expect(() => validateTripCreate({ name: null })).toThrow(ValidationError);
  });

  it("rejects a name over 100 chars", () => {
    expect(() => validateTripCreate({ name: "a".repeat(101) })).toThrow(
      ValidationError
    );
  });

  it("rejects a non-object body", () => {
    expect(() => validateTripCreate(null)).toThrow(ValidationError);
    expect(() => validateTripCreate("hello")).toThrow(ValidationError);
  });
});

describe("validateTripPatch", () => {
  it("returns empty object for empty patch", () => {
    expect(validateTripPatch({})).toEqual({});
  });

  it("validates only provided fields", () => {
    expect(validateTripPatch({ name: "New" })).toEqual({ name: "New" });
  });

  it("still rejects invalid name when provided", () => {
    expect(() => validateTripPatch({ name: "" })).toThrow(ValidationError);
  });
});

describe("validateReceiptCreate", () => {
  const validItem = {
    name: "Pizza",
    qty: 1,
    unitPrice: 50000,
    total: 50000,
    assignedToUserIds: [],
  };

  it("accepts a minimal valid payload", () => {
    const result = validateReceiptCreate({
      title: "Lunch",
      items: [validItem],
    });
    expect(result.title).toBe("Lunch");
    expect(result.items).toHaveLength(1);
    expect(result.tax).toBe(0);
    expect(result.service).toBe(0);
  });

  it("rejects empty items array", () => {
    expect(() =>
      validateReceiptCreate({ title: "Lunch", items: [] })
    ).toThrow(ValidationError);
  });

  it("rejects negative money values", () => {
    expect(() =>
      validateReceiptCreate({
        title: "Lunch",
        items: [validItem],
        tax: -1,
      })
    ).toThrow(ValidationError);
  });

  it("rejects astronomical amounts", () => {
    expect(() =>
      validateReceiptCreate({
        title: "Lunch",
        items: [{ ...validItem, total: 2_000_000_000 }],
      })
    ).toThrow(ValidationError);
  });

  it("rejects an invalid date", () => {
    expect(() =>
      validateReceiptCreate({
        title: "Lunch",
        items: [validItem],
        date: "not-a-date",
      })
    ).toThrow(ValidationError);
  });

  it("normalizes a valid date to ISO", () => {
    const result = validateReceiptCreate({
      title: "Lunch",
      items: [validItem],
      date: "2026-04-29",
    });
    expect(result.date).toMatch(/^2026-04-29T/);
  });

  it("rejects too many items", () => {
    const items = Array.from({ length: 201 }, () => ({ ...validItem }));
    expect(() => validateReceiptCreate({ title: "Lunch", items })).toThrow(
      ValidationError
    );
  });

  it("rejects qty of zero", () => {
    expect(() =>
      validateReceiptCreate({
        title: "Lunch",
        items: [{ ...validItem, qty: 0 }],
      })
    ).toThrow(ValidationError);
  });

  it("rejects NaN amounts", () => {
    expect(() =>
      validateReceiptCreate({
        title: "Lunch",
        items: [{ ...validItem, total: Number.NaN }],
      })
    ).toThrow(ValidationError);
  });
});

describe("validateReceiptPatch", () => {
  it("allows partial updates", () => {
    expect(validateReceiptPatch({ title: "Renamed" })).toEqual({
      title: "Renamed",
    });
  });

  it("clears date when explicit null", () => {
    expect(validateReceiptPatch({ date: null })).toEqual({ date: null });
  });

  it("validates fields when provided", () => {
    expect(() => validateReceiptPatch({ tax: -50 })).toThrow(ValidationError);
  });

  it("accepts a valid expectedVersion", () => {
    expect(validateReceiptPatch({ expectedVersion: 7 })).toEqual({
      expectedVersion: 7,
    });
  });

  it("rejects expectedVersion of 0 or negative", () => {
    expect(() => validateReceiptPatch({ expectedVersion: 0 })).toThrow(
      ValidationError
    );
    expect(() => validateReceiptPatch({ expectedVersion: -1 })).toThrow(
      ValidationError
    );
  });

  it("rejects non-integer expectedVersion", () => {
    expect(() => validateReceiptPatch({ expectedVersion: 1.5 })).toThrow(
      ValidationError
    );
  });
});

describe("validateTripPatch with expectedVersion", () => {
  it("accepts version", () => {
    expect(validateTripPatch({ name: "x", expectedVersion: 3 })).toEqual({
      name: "x",
      expectedVersion: 3,
    });
  });

  it("rejects invalid version", () => {
    expect(() => validateTripPatch({ expectedVersion: "abc" })).toThrow(
      ValidationError
    );
  });
});

describe("validateMemberAdd", () => {
  it("accepts a valid email and lowercases it", () => {
    expect(validateMemberAdd({ email: "Hello@Example.com" })).toEqual({
      email: "hello@example.com",
    });
  });

  it("rejects malformed emails", () => {
    expect(() => validateMemberAdd({ email: "not-an-email" })).toThrow(
      ValidationError
    );
    expect(() => validateMemberAdd({ email: "@example.com" })).toThrow(
      ValidationError
    );
    expect(() => validateMemberAdd({ email: "x@y" })).toThrow(ValidationError);
  });

  it("rejects missing email", () => {
    expect(() => validateMemberAdd({})).toThrow(ValidationError);
  });
});

describe("isUuid", () => {
  it("accepts a canonical UUID in either case", () => {
    expect(isUuid("d24c61ba-883f-444b-a1e8-cf38361be1d6")).toBe(true);
    expect(isUuid("D24C61BA-883F-444B-A1E8-CF38361BE1D6")).toBe(true);
  });

  // These are the shapes that reached Prisma and threw "Inconsistent column
  // data: Error creating UUID" — a 500 on what is really a malformed request.
  it("rejects anything a uuid column cannot parse", () => {
    expect(isUuid("cyzfjp6vz")).toBe(false); // an optimistic generateId() token
    expect(isUuid("")).toBe(false);
    expect(isUuid("d24c61ba883f444ba1e8cf38361be1d6")).toBe(false); // no dashes
    expect(isUuid("d24c61ba-883f-444b-a1e8-cf38361be1d")).toBe(false); // short
    expect(isUuid("d24c61ba-883f-444b-a1e8-cf38361be1d6x")).toBe(false); // trailing
    expect(isUuid("urn:uuid:d24c61ba-883f-444b-a1e8-cf38361be1d6")).toBe(false);
    expect(isUuid("zzzzzzzz-883f-444b-a1e8-cf38361be1d6")).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});
