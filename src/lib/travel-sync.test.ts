import { describe, it, expect } from "vitest";
import {
  classifyWriteResult,
  deriveSyncStatus,
  addReceiptToTrips,
  replaceReceiptInTrips,
  removeReceiptFromTrips,
  addPaymentToTrips,
  replacePaymentInTrips,
  removePaymentFromTrips,
} from "./travel-sync";
import { TravelTrip, Receipt, TripPayment } from "@/types";

const receipt = (id: string, title = id): Receipt => ({
  id,
  title,
  payerId: "a",
  items: [],
  tax: 0,
  service: 0,
});

const trip = (id: string, over: Partial<TravelTrip> = {}): TravelTrip => ({
  id,
  name: id,
  participants: [],
  receipts: [],
  ...over,
});

describe("classifyWriteResult", () => {
  it("returns ok on a 2xx response", () => {
    expect(classifyWriteResult(true, 200)).toBe("ok");
    expect(classifyWriteResult(true, 201)).toBe("ok");
  });
  it("returns conflict on 409 or VERSION_CONFLICT code", () => {
    expect(classifyWriteResult(false, 409)).toBe("conflict");
    expect(classifyWriteResult(false, 400, "VERSION_CONFLICT")).toBe("conflict");
  });
  it("returns error on any other failure", () => {
    expect(classifyWriteResult(false, 500)).toBe("error");
    expect(classifyWriteResult(false, 400, "BAD_REQUEST")).toBe("error");
    expect(classifyWriteResult(false, 401)).toBe("error");
  });
});

describe("deriveSyncStatus", () => {
  it("prioritises conflict over everything", () => {
    expect(deriveSyncStatus(3, "boom", true)).toBe("conflict");
  });
  it("shows saving while writes are in flight", () => {
    expect(deriveSyncStatus(1, null, false)).toBe("saving");
  });
  it("shows error when idle with an error", () => {
    expect(deriveSyncStatus(0, "boom", false)).toBe("error");
  });
  it("is idle when nothing is happening", () => {
    expect(deriveSyncStatus(0, null, false)).toBe("idle");
  });
});

describe("receipt reducers", () => {
  const trips = [trip("t1", { receipts: [receipt("r1")] }), trip("t2")];

  it("adds a receipt to the right trip only, immutably", () => {
    const next = addReceiptToTrips(trips, "t1", receipt("r2"));
    expect(next[0].receipts.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(next[1].receipts).toHaveLength(0);
    expect(trips[0].receipts).toHaveLength(1); // original untouched
    expect(next[0]).not.toBe(trips[0]);
  });

  it("replaces a receipt by id (optimistic update)", () => {
    const next = replaceReceiptInTrips(trips, "t1", receipt("r1", "renamed"));
    expect(next[0].receipts[0].title).toBe("renamed");
  });

  it("removes a receipt by id (delete / rollback)", () => {
    const withTwo = addReceiptToTrips(trips, "t1", receipt("r2"));
    const next = removeReceiptFromTrips(withTwo, "t1", "r2");
    expect(next[0].receipts.map((r) => r.id)).toEqual(["r1"]);
  });

  it("is a no-op for an unknown trip id", () => {
    expect(addReceiptToTrips(trips, "ghost", receipt("x"))).toEqual(trips);
  });
});

describe("payment reducers", () => {
  const pay = (id: string, amount = 100): TripPayment => ({ id, from: "b", to: "a", amount });
  const trips = [trip("t1", { payments: [pay("p1")] }), trip("t2")];

  it("adds a payment (handles undefined payments array)", () => {
    const next = addPaymentToTrips(trips, "t2", pay("p2"));
    expect(next[1].payments?.map((p) => p.id)).toEqual(["p2"]);
  });

  it("swaps an optimistic payment for the server one", () => {
    const withTemp = addPaymentToTrips(trips, "t1", pay("temp"));
    const next = replacePaymentInTrips(withTemp, "t1", "temp", pay("server", 150));
    expect(next[0].payments?.map((p) => p.id)).toEqual(["p1", "server"]);
    expect(next[0].payments?.find((p) => p.id === "server")?.amount).toBe(150);
  });

  it("removes a payment (delete / rollback on failure)", () => {
    const next = removePaymentFromTrips(trips, "t1", "p1");
    expect(next[0].payments).toEqual([]);
  });
});
