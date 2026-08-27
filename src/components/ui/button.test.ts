import { describe, expect, it } from "vitest";
import { buttonVariants } from "./button";

// These pin the two rules the whole app now leans on, so nobody has to
// rediscover them at 47 call sites: every size is thumb-sized on a phone, and
// every button answers a tap without waiting for a hover it will never get.

describe("buttonVariants", () => {
    const sizes = ["default", "sm", "lg", "icon", "pill"] as const;

    it.each(sizes)("size=%s is at least 44px tall on mobile", (size) => {
        const classes = buttonVariants({ size }).split(/\s+/);
        // h-11 = 44px, h-12 = 48px. An unprefixed h-9/h-10 here would mean a
        // sub-44px target under a thumb.
        expect(classes).toSatisfy((cs: string[]) =>
            cs.includes("h-11") || cs.includes("h-12")
        );
    });

    it("shrinks sm back down from the sm: breakpoint up, where input is a mouse", () => {
        expect(buttonVariants({ size: "sm" })).toContain("sm:h-9");
    });

    it("gives press feedback that does not depend on hover", () => {
        // Touch screens have no hover; before this, tapping produced no visual
        // response at all. Scale is a transform, so it moves no neighbours.
        expect(buttonVariants()).toContain("active:scale-[0.97]");
    });

    it("does not animate a press on a disabled button", () => {
        expect(buttonVariants()).toContain("disabled:active:scale-100");
    });
});
