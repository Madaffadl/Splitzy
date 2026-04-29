import { describe, it, expect } from "vitest";
import { encodeShare, decodeShare, buildShareUrl } from "./share";
import type { Receipt, Participant } from "@/types";

const sampleReceipt: Receipt = {
  id: "r1",
  title: "Friday Dinner",
  payerId: "p1",
  tax: 22000,
  service: 18000,
  items: [
    {
      id: "i1",
      name: "Pizza",
      qty: 1,
      unitPrice: 95000,
      total: 95000,
      assignedToIds: ["p1", "p2"],
    },
    {
      id: "i2",
      name: "Iced Tea",
      qty: 2,
      unitPrice: 15000,
      total: 30000,
      assignedToIds: ["p1"],
    },
  ],
};

const sampleParticipants: Participant[] = [
  { id: "p1", name: "Alex" },
  { id: "p2", name: "Bella" },
];

describe("share encode/decode", () => {
  it("round-trips a typical receipt", () => {
    const encoded = encodeShare({
      title: "Dinner",
      receipt: sampleReceipt,
      participants: sampleParticipants,
    });

    const decoded = decodeShare(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded?.title).toBe("Dinner");
    expect(decoded?.receipt.title).toBe("Friday Dinner");
    expect(decoded?.receipt.items).toHaveLength(2);
    expect(decoded?.participants).toHaveLength(2);
    expect(decoded?.v).toBe(1);
  });

  it("handles non-ASCII names safely", () => {
    const encoded = encodeShare({
      title: "Makan-makan ☕",
      receipt: sampleReceipt,
      participants: [
        { id: "p1", name: "André" },
        { id: "p2", name: "日本語" },
      ],
    });

    const decoded = decodeShare(encoded);
    expect(decoded?.title).toBe("Makan-makan ☕");
    expect(decoded?.participants[0].name).toBe("André");
    expect(decoded?.participants[1].name).toBe("日本語");
  });

  it("produces URL-safe output (no +, /, or =)", () => {
    const encoded = encodeShare({
      title: "Test",
      receipt: sampleReceipt,
      participants: sampleParticipants,
    });
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns null for empty input", () => {
    expect(decodeShare("")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(decodeShare("!!!not-base64!!!")).toBeNull();
    expect(decodeShare("YWJjZA")).toBeNull(); // valid base64 of "abcd", not JSON
  });

  it("returns null for wrong version", () => {
    // Manually craft a payload with version 99
    const fake = btoa(JSON.stringify({ v: 99, title: "x", receipt: sampleReceipt, participants: [] }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeShare(fake)).toBeNull();
  });

  it("rejects payloads missing required fields", () => {
    const fake = btoa(JSON.stringify({ v: 1, title: "x" }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeShare(fake)).toBeNull();
  });

  it("throws when payload exceeds size limit", () => {
    // Build an oversized receipt by adding many participants/items.
    const huge: Receipt = {
      ...sampleReceipt,
      items: Array.from({ length: 500 }, (_, i) => ({
        id: `i${i}`,
        name: `Item with a fairly long name ${i} `.repeat(5),
        qty: 1,
        unitPrice: 10000,
        total: 10000,
        assignedToIds: ["p1", "p2"],
      })),
    };
    expect(() =>
      encodeShare({ title: "Big", receipt: huge, participants: sampleParticipants })
    ).toThrow(/too large/i);
  });
});

describe("buildShareUrl", () => {
  it("appends encoded payload as URL hash", () => {
    const url = buildShareUrl("https://app.example.com", "abc123");
    expect(url).toBe("https://app.example.com/share#abc123");
  });

  it("strips trailing slash from origin", () => {
    const url = buildShareUrl("https://app.example.com/", "abc123");
    expect(url).toBe("https://app.example.com/share#abc123");
  });
});
