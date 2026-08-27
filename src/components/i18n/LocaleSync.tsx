"use client";

import { useEffect } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { readStoredLocale, storeLocale } from "@/lib/i18n/use-locale";

/**
 * Records the locale of the page the visitor is actually reading.
 *
 * The marketing pages know their own locale from the URL; the tool pages are
 * single-URL and cannot (see use-locale.ts). Dropping this on every localized
 * marketing page is what carries the choice across: land on /id, read
 * Indonesian, tap "Split bill — gratis", and /single is Indonesian too.
 *
 * Renders nothing.
 */
export function LocaleSync({ locale }: { locale: Locale }) {
    useEffect(() => {
        // Only a deliberate signal may overwrite a stored choice, and `/id` is
        // one: you do not arrive there by accident. `/` is not — it is the
        // default and the catch-all — so there it only seeds a preference that
        // does not exist yet.
        //
        // Writing unconditionally meant visiting `/` reverted an Indonesian
        // user to English, silently, which is what tapping the logo from a tool
        // page does. It also produced a modal in two languages at once: the
        // first-run dialog read the preference before this effect clobbered it,
        // while the mock inside it mounts a commit later — through a Radix
        // portal — and read the clobbered value.
        if (locale !== DEFAULT_LOCALE || readStoredLocale() === null) {
            storeLocale(locale);
        }
    }, [locale]);

    return null;
}
