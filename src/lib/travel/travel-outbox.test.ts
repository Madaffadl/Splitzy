import { describe, it, expect } from "vitest";
import { pushOp, removeOp, replayOps, receiptIdOf, ReceiptOp } from "./travel-outbox";
import { TravelTrip, Receipt } from "@/types";

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

const add = (opId: string, tripId: string, r: Receipt): ReceiptOp => ({ opId, kind: "add", tripId, receipt: r });
const update = (opId: string, tripId: string, r: Receipt): ReceiptOp => ({ opId, kind: "update", tripId, receipt: r });
const del = (opId: string, tripId: string, receiptId: string): ReceiptOp => ({ opId, kind: "delete", tripId, receiptId });

describe("receiptIdOf", () => {
  it("returns the receipt id for add/update and the target for delete", () => {
    expect(receiptIdOf(add("o1", "t1", receipt("r1")))).toBe("r1");
    expect(receiptIdOf(del("o2", "t1", "r1"))).toBe("r1");
  });
});

describe("pushOp coalescing", () => {
  it("appends unrelated ops in order", () => {
    let ops: ReceiptOp[] = [];
    ops = pushOp(ops, add("o1", "t1", receipt("r1")));
    ops = pushOp(ops, add("o2", "t1", receipt("r2")));
    expect(ops.map((o) => o.opId)).toEqual(["o1", "o2"]);
  });

  it("collapses repeated edits of the same receipt to a single op with the latest content", () => {
    let ops: ReceiptOp[] = [];
    ops = pushOp(ops, add("o1", "t1", receipt("r1", "v1")));
    ops = pushOp(ops, update("o2", "t1", receipt("r1", "v2")));
    ops = pushOp(ops, update("o3", "t1", receipt("r1", "v3")));
    expect(ops).toHaveLength(1);
    const only = ops[0];
    expect(only.kind).toBe("add"); // still a create — server never saw it
    expect(only.opId).toBe("o1"); // original opId preserved
    if (only.kind !== "delete") expect(only.receipt.title).toBe("v3"); // latest content
  });

  it("keeps kind 'update' when the receipt already existed on the server", () => {
    let ops: ReceiptOp[] = [];
    ops = pushOp(ops, update("o1", "t1", receipt("r1", "v1")));
    ops = pushOp(ops, update("o2", "t1", receipt("r1", "v2")));
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe("update");
  });

  it("cancels an add+delete of a never-synced receipt entirely", () => {
    let ops: ReceiptOp[] = [];
    ops = pushOp(ops, add("o1", "t1", receipt("r1")));
    ops = pushOp(ops, del("o2", "t1", "r1"));
    expect(ops).toHaveLength(0);
  });

  it("keeps a delete for a receipt that only had a pending update (exists on server)", () => {
    let ops: ReceiptOp[] = [];
    ops = pushOp(ops, update("o1", "t1", receipt("r1")));
    ops = pushOp(ops, del("o2", "t1", "r1"));
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe("delete");
  });

  it("does not coalesce same receipt id across different trips", () => {
    let ops: ReceiptOp[] = [];
    ops = pushOp(ops, add("o1", "t1", receipt("r1")));
    ops = pushOp(ops, add("o2", "t2", receipt("r1")));
    expect(ops).toHaveLength(2);
  });
});

describe("removeOp", () => {
  it("removes a settled op by id", () => {
    const ops = [add("o1", "t1", receipt("r1")), add("o2", "t1", receipt("r2"))];
    expect(removeOp(ops, "o1").map((o) => o.opId)).toEqual(["o2"]);
  });
});

describe("replayOps", () => {
  it("adds a pending receipt on top of server trips", () => {
    const server = [trip("t1")];
    const result = replayOps(server, [add("o1", "t1", receipt("r1"))]);
    expect(result[0].receipts.map((r) => r.id)).toEqual(["r1"]);
  });

  it("is idempotent — replaying an add over a receipt already present does not duplicate", () => {
    const server = [trip("t1", { receipts: [receipt("r1", "server")] })];
    const result = replayOps(server, [add("o1", "t1", receipt("r1", "local"))]);
    expect(result[0].receipts).toHaveLength(1);
    expect(result[0].receipts[0].title).toBe("local"); // local pending content wins
  });

  it("applies a pending delete", () => {
    const server = [trip("t1", { receipts: [receipt("r1")] })];
    const result = replayOps(server, [del("o1", "t1", "r1")]);
    expect(result[0].receipts).toHaveLength(0);
  });

  it("folds multiple ops in order", () => {
    const server = [trip("t1")];
    const result = replayOps(server, [
      add("o1", "t1", receipt("r1")),
      add("o2", "t1", receipt("r2")),
      del("o3", "t1", "r1"),
    ]);
    expect(result[0].receipts.map((r) => r.id)).toEqual(["r2"]);
  });

  it("ignores ops for a trip the server no longer has", () => {
    const server = [trip("t1")];
    const result = replayOps(server, [add("o1", "gone", receipt("r1"))]);
    expect(result).toEqual(server);
  });
});
