import { describe, it, expect } from "vitest";
import { buildReceiptCsv, csvFilename } from "./csv-export";
import type { Receipt, Participant } from "@/types";

const participants: Participant[] = [
  { id: "p1", name: "Alex" },
  { id: "p2", name: "Bella, the Brave" }, // contains comma — must be quoted
  { id: "p3", name: 'Cara "C" Doe' }, // contains quotes — must be escaped
];

const receipt: Receipt = {
  id: "r1",
  title: "Friday Dinner",
  payerId: "p1",
  tax: 22000,
  service: 18000,
  items: [
    {
      id: "i1",
      name: "Pizza, Margherita",
      qty: 1,
      unitPrice: 95000,
      total: 95000,
      assignedToIds: ["p1", "p2", "p3"],
    },
    {
      id: "i2",
      name: "Iced Tea",
      qty: 2,
      unitPrice: 15000,
      total: 30000,
      assignedToIds: ["p1"],
    },
    {
      id: "i3",
      name: "Unassigned Item",
      qty: 1,
      unitPrice: 10000,
      total: 10000,
      assignedToIds: [],
    },
  ],
};

describe("buildReceiptCsv", () => {
  it("escapes commas by quoting", () => {
    const csv = buildReceiptCsv(receipt, participants, "Test");
    // Item with comma is quoted
    expect(csv).toContain('"Pizza, Margherita"');
    // Participant with comma is quoted (in shared-with column)
    expect(csv).toContain('"Bella, the Brave"');
  });

  it("escapes inner quotes by doubling them", () => {
    const csv = buildReceiptCsv(receipt, participants, "Test");
    // "Cara \"C\" Doe" → "Cara ""C"" Doe" (RFC 4180)
    expect(csv).toContain('"Cara ""C"" Doe"');
  });

  it("includes per-person breakdown rows", () => {
    const csv = buildReceiptCsv(receipt, participants, "Test");
    expect(csv).toContain("Person,Subtotal,Tax share,Service share,Total");
    expect(csv).toContain("Alex");
  });

  it("marks unassigned items explicitly", () => {
    const csv = buildReceiptCsv(receipt, participants, "Test");
    expect(csv).toContain("(unassigned)");
  });

  it("includes grand total = subtotal + tax + service", () => {
    const csv = buildReceiptCsv(receipt, participants, "Test");
    // Total = 95000 + 30000 + 10000 + 22000 + 18000 = 175000
    expect(csv).toContain("Grand total,175000");
  });

  it("uses CRLF line endings (RFC 4180)", () => {
    const csv = buildReceiptCsv(receipt, participants, "Test");
    expect(csv).toContain("\r\n");
  });
});

describe("csvFilename", () => {
  it("slugifies title", () => {
    expect(csvFilename("Friday Dinner @ Joe's")).toMatch(
      /^splitzy-friday-dinner-joe-s-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });

  it("falls back when title yields empty slug", () => {
    expect(csvFilename("!!!")).toMatch(/^splitzy-split-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("caps slug length", () => {
    const long = "a".repeat(200);
    const name = csvFilename(long);
    // splitzy- (8) + slug ≤ 50 + - (1) + YYYY-MM-DD (10) + .csv (4) = 73
    expect(name.length).toBeLessThanOrEqual(73);
  });
});
