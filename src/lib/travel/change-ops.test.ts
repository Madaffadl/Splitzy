import { describe, it, expect } from "vitest";
import { applyOpsToTrip, describeChangeOp, receiptGross, ChangeOp } from "./change-ops";
import { validateChangeOps } from "./travel-cloud";
import { ValidationError } from "@/lib/validation";
import { TravelTrip, Receipt, Participant } from "@/types";

// ── Fixtures ─────────────────────────────────────────────────────────────────
const p = (id: string, name: string): Participant => ({ id, name });

const receipt = (id: string, title: string, payerId: string, total: number, assignees: string[]): Receipt => ({
  id,
  title,
  payerId,
  tax: 0,
  service: 0,
  items: [{ id: `${id}-i`, name: "item", qty: 1, unitPrice: total, total, assignedToIds: assignees }],
});

const baseTrip = (): TravelTrip => ({
  id: "trip1",
  name: "Trip",
  version: 3,
  participants: [p("a", "Alice"), p("b", "Bob")],
  receipts: [receipt("r1", "Lunch", "a", 100, ["a", "b"])],
  payments: [],
});

// ── applyOpsToTrip (client overlay) ──────────────────────────────────────────
describe("applyOpsToTrip", () => {
  it("adds a receipt", () => {
    const next = applyOpsToTrip(baseTrip(), [
      { kind: "receipt.add", receipt: receipt("r2", "Dinner", "b", 200, ["a", "b"]) },
    ]);
    expect(next.receipts.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("updates a receipt in place (idempotent by id)", () => {
    const edited = receipt("r1", "Lunch v2", "a", 120, ["a", "b"]);
    const next = applyOpsToTrip(baseTrip(), [{ kind: "receipt.update", receipt: edited }]);
    expect(next.receipts).toHaveLength(1);
    expect(next.receipts[0].title).toBe("Lunch v2");
  });

  it("deletes a receipt", () => {
    const next = applyOpsToTrip(baseTrip(), [{ kind: "receipt.delete", receiptId: "r1" }]);
    expect(next.receipts).toHaveLength(0);
  });

  it("replaces participants and updates trip fields", () => {
    const next = applyOpsToTrip(baseTrip(), [
      { kind: "participants.set", participants: [p("a", "Alice"), p("b", "Bob"), p("c", "Cara")] },
      { kind: "trip.update", name: "Renamed", budget: 500 },
    ]);
    expect(next.participants.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(next.name).toBe("Renamed");
    expect(next.budget).toBe(500);
  });

  it("clears the budget when trip.update sets budget null", () => {
    const trip = { ...baseTrip(), budget: 1000 };
    const next = applyOpsToTrip(trip, [{ kind: "trip.update", budget: null }]);
    expect(next.budget).toBeUndefined();
  });

  it("overlays an added payment and removes a deleted one", () => {
    const trip: TravelTrip = {
      ...baseTrip(),
      payments: [{ id: "pay1", from: "b", to: "a", amount: 50, createdAt: "2026-01-01" }],
    };
    const next = applyOpsToTrip(trip, [
      { kind: "payment.add", payment: { from: "a", to: "b", amount: 30 } },
      { kind: "payment.delete", paymentId: "pay1" },
    ]);
    expect(next.payments?.map((x) => x.from)).toEqual(["a"]);
    expect(next.payments?.[0].amount).toBe(30);
  });

  it("does not mutate the input trip", () => {
    const trip = baseTrip();
    const before = JSON.stringify(trip);
    applyOpsToTrip(trip, [{ kind: "receipt.delete", receiptId: "r1" }]);
    expect(JSON.stringify(trip)).toBe(before);
  });
});

// ── describeChangeOp ─────────────────────────────────────────────────────────
describe("describeChangeOp", () => {
  const nameOf = (id: string) => ({ a: "Alice", b: "Bob" }[id] ?? "?");

  it("summarizes a receipt add with gross amount", () => {
    const r = receipt("r9", "Cafe", "a", 150, ["a", "b"]);
    const d = describeChangeOp({ kind: "receipt.add", receipt: r }, nameOf);
    expect(d.action).toBe("Added receipt");
    expect(d.detail).toBe("Cafe");
    expect(d.amount).toBe(receiptGross(r));
    expect(d.tone).toBe("add");
  });

  it("summarizes a payment with participant names", () => {
    const d = describeChangeOp({ kind: "payment.add", payment: { from: "b", to: "a", amount: 50 } }, nameOf);
    expect(d.detail).toBe("Bob → Alice");
    expect(d.tone).toBe("add");
  });
});

// ── validateChangeOps (server) ───────────────────────────────────────────────
describe("validateChangeOps", () => {
  const ids = () => new Set(["a", "b"]);

  it("accepts a valid batch", () => {
    const raw: ChangeOp[] = [
      { kind: "receipt.add", receipt: receipt("r2", "Dinner", "a", 200, ["a", "b"]) },
      { kind: "payment.add", payment: { from: "b", to: "a", amount: 100 } },
    ];
    const out = validateChangeOps(raw, ids());
    expect(out).toHaveLength(2);
  });

  it("threads a newly-added participant so a later receipt can reference them", () => {
    const raw: ChangeOp[] = [
      { kind: "participants.set", participants: [p("a", "Alice"), p("b", "Bob"), p("c", "Cara")] },
      { kind: "receipt.add", receipt: receipt("r2", "Dinner", "c", 90, ["a", "b", "c"]) },
    ];
    const out = validateChangeOps(raw, ids());
    expect(out).toHaveLength(2);
  });

  it("rejects a receipt referencing an unknown participant", () => {
    const raw = [{ kind: "receipt.add", receipt: receipt("r2", "X", "zzz", 50, ["zzz"]) }];
    expect(() => validateChangeOps(raw, ids())).toThrow(ValidationError);
  });

  it("rejects an empty batch", () => {
    expect(() => validateChangeOps([], ids())).toThrow(ValidationError);
  });

  it("rejects an unknown op kind", () => {
    expect(() => validateChangeOps([{ kind: "trip.nuke" }], ids())).toThrow(ValidationError);
  });

  it("rejects a payment between the same participant", () => {
    const raw = [{ kind: "payment.add", payment: { from: "a", to: "a", amount: 10 } }];
    expect(() => validateChangeOps(raw, ids())).toThrow(ValidationError);
  });
});
