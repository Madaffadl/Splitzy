import type { Locale } from "@/lib/i18n/config";
import { id, type Dictionary } from "./id";
import { en } from "./en";

export type { Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { id, en };

/**
 * Copy for `locale`. Synchronous by design — both dictionaries are plain
 * objects in the server bundle, so there is nothing to await and pages stay
 * fully static.
 */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
