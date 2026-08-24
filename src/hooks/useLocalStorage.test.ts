// @vitest-environment happy-dom
/**
 * Tests for useLocalStorage — in particular the persist-error reporting that a
 * full or blocked storage used to swallow into a console.warn, losing the user's
 * whole split on the next reload without a word.
 */

import { renderHook, act } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useLocalStorage } from "./useLocalStorage";

interface State {
    items: string[];
}

const KEY = "test-key";
const INITIAL: State = { items: [] };

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("useLocalStorage — normal operation", () => {
    it("starts with the initial value and no error", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        expect(result.current[0]).toEqual(INITIAL);
        expect(result.current[3]).toBeNull();
    });

    it("hydrates from an existing localStorage entry after mount", () => {
        localStorage.setItem(KEY, JSON.stringify({ items: ["a", "b"] }));
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        expect(result.current[0]).toEqual({ items: ["a", "b"] });
    });

    it("writes through to localStorage on set", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        act(() => result.current[1]({ items: ["x"] }));
        expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ items: ["x"] });
        expect(result.current[0]).toEqual({ items: ["x"] });
    });

    it("supports a functional updater that reads the latest value", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        act(() => result.current[1]((prev) => ({ items: [...prev.items, "1"] })));
        act(() => result.current[1]((prev) => ({ items: [...prev.items, "2"] })));
        expect(result.current[0]).toEqual({ items: ["1", "2"] });
    });

    it("chains two functional updaters inside a single act (read-after-write)", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        act(() => {
            result.current[1]((prev) => ({ items: [...prev.items, "a"] }));
            result.current[1]((prev) => ({ items: [...prev.items, "b"] }));
        });
        expect(result.current[0]).toEqual({ items: ["a", "b"] });
    });

    it("reset clears storage and returns to the initial value", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        act(() => result.current[1]({ items: ["x"] }));
        act(() => result.current[2]());
        expect(localStorage.getItem(KEY)).toBeNull();
        expect(result.current[0]).toEqual(INITIAL);
    });

    it("survives a corrupt JSON entry by keeping the initial value", () => {
        localStorage.setItem(KEY, "{not json");
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        expect(result.current[0]).toEqual(INITIAL);
    });
});

// ---------------------------------------------------------------------------
// Persist error reporting
// ---------------------------------------------------------------------------

/** Build the DOMException Chrome/Edge throw when storage is full. */
function quotaError(): DOMException {
    return new DOMException("The quota has been exceeded.", "QuotaExceededError");
}

describe("useLocalStorage — persist error reporting", () => {
    it("reports kind 'quota' when setItem throws QuotaExceededError", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        vi.spyOn(localStorage, "setItem").mockImplementation(() => {
            throw quotaError();
        });

        act(() => result.current[1]({ items: ["big"] }));

        expect(result.current[3]).not.toBeNull();
        expect(result.current[3]!.kind).toBe("quota");
        expect(result.current[3]!.key).toBe(KEY);
    });

    it("recognises the Firefox quota exception name", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        vi.spyOn(localStorage, "setItem").mockImplementation(() => {
            throw new DOMException("quota", "NS_ERROR_DOM_QUOTA_REACHED");
        });

        act(() => result.current[1]({ items: ["big"] }));
        expect(result.current[3]!.kind).toBe("quota");
    });

    it("reports kind 'unavailable' for a non-quota failure (blocked storage)", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        vi.spyOn(localStorage, "setItem").mockImplementation(() => {
            throw new DOMException("Access denied.", "SecurityError");
        });

        act(() => result.current[1]({ items: ["x"] }));
        expect(result.current[3]!.kind).toBe("unavailable");
    });

    it("reports 'unavailable' for a plain Error (not a DOMException)", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        vi.spyOn(localStorage, "setItem").mockImplementation(() => {
            throw new Error("boom");
        });

        act(() => result.current[1]({ items: ["x"] }));
        expect(result.current[3]!.kind).toBe("unavailable");
    });

    it("keeps the in-memory value usable even when the write fails", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        vi.spyOn(localStorage, "setItem").mockImplementation(() => {
            throw quotaError();
        });

        act(() => result.current[1]({ items: ["unsaved"] }));

        // The split must keep working for the current session — only durability
        // is lost, and that's exactly what the error is there to announce.
        expect(result.current[0]).toEqual({ items: ["unsaved"] });
    });

    it("clears the error once a later write succeeds", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
            throw quotaError();
        });

        act(() => result.current[1]({ items: ["fail"] }));
        expect(result.current[3]).not.toBeNull();

        spy.mockRestore();
        act(() => result.current[1]({ items: ["ok"] }));
        expect(result.current[3]).toBeNull();
    });

    it("stamps each failure with a fresh timestamp so callers can de-duplicate", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        vi.spyOn(localStorage, "setItem").mockImplementation(() => {
            throw quotaError();
        });

        const now = vi.spyOn(Date, "now");
        now.mockReturnValue(1000);
        act(() => result.current[1]({ items: ["a"] }));
        const first = result.current[3]!.at;

        now.mockReturnValue(2000);
        act(() => result.current[1]({ items: ["b"] }));
        const second = result.current[3]!.at;

        expect(first).toBe(1000);
        expect(second).toBe(2000);
    });

    it("reset clears a standing persist error", () => {
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
            throw quotaError();
        });

        act(() => result.current[1]({ items: ["fail"] }));
        expect(result.current[3]).not.toBeNull();

        spy.mockRestore();
        act(() => result.current[2]());
        expect(result.current[3]).toBeNull();
    });

    it("does not report an error for a failed read (load is best-effort)", () => {
        vi.spyOn(localStorage, "getItem").mockImplementation(() => {
            throw quotaError();
        });
        const { result } = renderHook(() => useLocalStorage<State>(KEY, INITIAL));
        expect(result.current[3]).toBeNull();
        expect(result.current[0]).toEqual(INITIAL);
    });
});
