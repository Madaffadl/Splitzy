import { describe, expect, it } from "vitest";
import { fill } from "./use-locale";
import { id } from "./dictionaries/id";
import { en } from "./dictionaries/en";

describe("fill", () => {
    it("substitutes named placeholders", () => {
        expect(fill("{count} peserta", { count: 3 })).toBe("3 peserta");
    });

    it("leaves an unknown placeholder alone rather than printing undefined", () => {
        expect(fill("Hapus {name}", {})).toBe("Hapus {name}");
    });

    it("substitutes every occurrence", () => {
        expect(fill("{a} and {a}", { a: "x" })).toBe("x and x");
    });
});

describe("app copy", () => {
    // TypeScript already enforces the shape (Dictionary is typeof id, and en is
    // typed against it). These check the things the type cannot see.

    it("keeps mode names identical to the landing's, so they cannot drift", () => {
        // A mode advertised as "Banyak Struk" on /id and called something else
        // once you are inside it is the exact inconsistency this namespace was
        // added to remove.
        expect(id.app.modes.single.title).toBe(id.modes.items[0].title);
        expect(id.app.modes.multiple.title).toBe(id.modes.items[1].title);
        expect(id.app.modes.travel.title).toBe(id.modes.items[2].title);

        expect(en.app.modes.single.title).toBe(en.modes.items[0].title);
        expect(en.app.modes.multiple.title).toBe(en.modes.items[1].title);
        expect(en.app.modes.travel.title).toBe(en.modes.items[2].title);
    });

    it("carries the same placeholders in both languages", () => {
        const placeholders = (s: string) =>
            (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");

        const pairs: Array<[string, string]> = [
            [id.app.participants.count, en.app.participants.count],
            [id.app.participants.removeAria, en.app.participants.removeAria],
            [id.app.participants.duplicateBody, en.app.participants.duplicateBody],
            [id.app.stepper.srStepOf, en.app.stepper.srStepOf],
        ];

        for (const [a, b] of pairs) {
            expect(placeholders(a)).toBe(placeholders(b));
        }
    });

    it("has actually been translated, not copied across", () => {
        // Catches the failure mode where a key is added to id.ts by pasting the
        // English and moving on.
        expect(id.app.common.back).not.toBe(en.app.common.back);
        expect(id.app.stepper.participants).not.toBe(en.app.stepper.participants);
        expect(id.app.participants.emptyTitle).not.toBe(
            en.app.participants.emptyTitle
        );
    });
});
