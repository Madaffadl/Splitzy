"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

const STORAGE_KEY = "splitzy-locale";

/**
 * Which language the product UI should speak.
 *
 * The marketing tree gets its locale from the URL (`/` vs `/id`). The tool
 * routes cannot: they are deliberately single-URL — see the note in
 * i18n/config.ts about hreflang reciprocity — so /single has no path segment to
 * read a locale from. And they are statically prerendered (a requirement: the
 * build must keep /single, /multiple and /travel as ○), which rules out reading
 * a cookie on the server, because that would make them ƒ dynamic.
 *
 * So the tool pages follow a persisted preference, written by whichever
 * localized landing the visitor came through. That is the actual journey the
 * translation exists to fix: arrive at /id, read Indonesian, tap the CTA, and
 * keep reading Indonesian.
 *
 * Trade-off, stated plainly: the preference can only be read after hydration,
 * so the very first paint of a tool page uses DEFAULT_LOCALE. An Indonesian
 * visitor sees one frame of English before it settles. Removing that would mean
 * making these routes dynamic, which costs more than it buys.
 */
export function readStoredLocale(): Locale | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return LOCALES.includes(raw as Locale) ? (raw as Locale) : null;
    } catch {
        return null;
    }
}

export function storeLocale(locale: Locale): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
        // Private mode / storage blocked. The UI just stays on the default.
    }
}

/** The active locale for a client component. */
export function useLocale(): Locale {
    const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

    useEffect(() => {
        const stored = readStoredLocale();
        if (stored) {
            setLocale(stored);
            return;
        }
        // No preference yet — take the browser's hint, but only for a locale we
        // actually publish. Not persisted: a real choice (visiting /id, or using
        // the switcher) should still win later.
        const nav = navigator.language?.slice(0, 2).toLowerCase();
        const match = LOCALES.find((l) => l === nav);
        if (match) setLocale(match);
    }, []);

    return locale;
}

/** The dictionary for the active locale. */
export function useDictionary(): Dictionary {
    return getDictionary(useLocale());
}

/**
 * Substitute `{name}` placeholders.
 *
 * Deliberately tiny — the alternative is a runtime i18n library, and this app
 * needs interpolation in about a dozen strings, not a framework.
 */
export function fill(
    template: string,
    vars: Record<string, string | number>
): string {
    return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
        key in vars ? String(vars[key]) : whole
    );
}
