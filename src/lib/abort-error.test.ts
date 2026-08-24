/**
 * Tests for isAbortError — the classifier that decides whether a failed vision
 * call was OUR timeout (transient, retry) or a genuine processing failure
 * (the photo really was unreadable).
 *
 * Getting this wrong is not cosmetic: a timeout reported as "couldn't read the
 * image" sends the user off re-cropping a receipt that would have scanned fine.
 */

import { describe, it, expect } from "vitest";
import { isAbortError } from "./api-response";

describe("isAbortError — recognises timeouts", () => {
    it("matches the SDK's abort error by name", () => {
        const err = new Error("Request aborted.");
        err.name = "GoogleGenerativeAIAbortError";
        expect(isAbortError(err)).toBe(true);
    });

    it("matches a plain fetch AbortError by name", () => {
        const err = new Error("The operation was aborted.");
        err.name = "AbortError";
        expect(isAbortError(err)).toBe(true);
    });

    it("matches a DOMException AbortError", () => {
        expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
    });

    it("matches on message wording when the name is unhelpful", () => {
        // Guards against the SDK renaming its error class: the message is the
        // fallback signal.
        expect(isAbortError(new Error("Request timed out after 45000ms"))).toBe(true);
        expect(isAbortError(new Error("timeout exceeded"))).toBe(true);
        expect(isAbortError(new Error("The request was aborted"))).toBe(true);
    });

    it("is case-insensitive on the message", () => {
        expect(isAbortError(new Error("TIMED OUT"))).toBe(true);
        expect(isAbortError(new Error("Aborted"))).toBe(true);
    });
});

describe("isAbortError — leaves real failures alone", () => {
    it("does not match a generic API error", () => {
        expect(isAbortError(new Error("400 Bad Request: invalid image"))).toBe(false);
    });

    it("does not match a safety/content block", () => {
        expect(isAbortError(new Error("Candidate was blocked due to SAFETY"))).toBe(false);
    });

    it("does not match an auth failure", () => {
        const err = new Error("API key not valid");
        err.name = "GoogleGenerativeAIFetchError";
        expect(isAbortError(err)).toBe(false);
    });

    it("does not match a quota/rate error from upstream", () => {
        expect(isAbortError(new Error("429 Too Many Requests"))).toBe(false);
    });
});

describe("isAbortError — defensive against non-Error throws", () => {
    it("returns false for null and undefined", () => {
        expect(isAbortError(null)).toBe(false);
        expect(isAbortError(undefined)).toBe(false);
    });

    it("returns false for primitives", () => {
        expect(isAbortError("timeout")).toBe(false);
        expect(isAbortError(504)).toBe(false);
        expect(isAbortError(true)).toBe(false);
    });

    it("returns false for an empty object", () => {
        expect(isAbortError({})).toBe(false);
    });

    it("matches a plain object carrying the right shape", () => {
        // Some transports reject with a plain object rather than an Error.
        expect(isAbortError({ name: "AbortError" })).toBe(true);
        expect(isAbortError({ message: "request timed out" })).toBe(true);
    });

    it("ignores a non-string message", () => {
        expect(isAbortError({ message: 12345 })).toBe(false);
    });
});
