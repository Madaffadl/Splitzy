"use client";

import { Globe } from "@/components/ui/icons";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { storeLocale, useLocale } from "@/lib/i18n/use-locale";

/**
 * Switches the language the product UI speaks.
 *
 * The only way to change language used to be a link in the landing footer,
 * roughly twelve full-height sections below the fold, on a page whose market is
 * Indonesia. Someone who landed on the English root had no realistic way to find
 * it — and someone already inside a split had none at all, because the tool
 * routes have no footer link either.
 *
 * It writes the preference and reloads. A reload rather than a re-render because
 * the marketing tree takes its locale from the URL while the tool routes take it
 * from this preference; going through the server keeps the two from disagreeing
 * about which language the page is in.
 */
export function LocaleSwitcher({ className = "" }: { className?: string }) {
    const current = useLocale();
    const dict = getDictionary(current);
    const next: Locale = LOCALES.find((l) => l !== current) ?? current;
    const nextName = getDictionary(next).languageName;

    return (
        <button
            type="button"
            onClick={() => {
                storeLocale(next);
                // The landing lives at a locale-specific path; the tool routes
                // do not. Send each to the right place for `next`.
                const path = window.location.pathname;
                const onLanding = path === "/" || path === "/id";
                window.location.assign(onLanding ? (next === "id" ? "/id" : "/") : path);
            }}
            aria-label={`${dict.app.locale.switchAria} — ${nextName}`}
            title={nextName}
            className={
                "touch-manipulation flex h-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground " +
                className
            }
        >
            <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="uppercase">{current}</span>
        </button>
    );
}
