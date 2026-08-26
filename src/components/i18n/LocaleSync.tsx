"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n/config";
import { storeLocale } from "@/lib/i18n/use-locale";

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
        storeLocale(locale);
    }, [locale]);

    return null;
}
