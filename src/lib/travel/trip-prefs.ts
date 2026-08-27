// Per-trip UI preferences that don't need server persistence.
// Stored in localStorage so they survive page refresh without a DB migration.
// Cloud users: prefs are device-local (acceptable for V1).

const KEY = "splitzy_trip_prefs_v1";

interface TripPrefs {
  defaultCurrency?: string;
  archivedAt?: string; // ISO date when the user archived the trip
}

type PrefsStore = Record<string, TripPrefs>;

function load(): PrefsStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PrefsStore) : {};
  } catch {
    return {};
  }
}

function save(store: PrefsStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {}
}

export function getTripPref(tripId: string): TripPrefs {
  return load()[tripId] ?? {};
}

export function setTripPref(tripId: string, patch: Partial<TripPrefs>): void {
  const store = load();
  store[tripId] = { ...(store[tripId] ?? {}), ...patch };
  save(store);
}

/** Merge persisted prefs into a list of trips (used after cloud load). */
export function mergePrefs<T extends { id: string }>(
  trips: T[]
): (T & { defaultCurrency?: string })[] {
  const store = load();
  return trips.map((t) => {
    const p = store[t.id];
    return p?.defaultCurrency ? { ...t, defaultCurrency: p.defaultCurrency } : t;
  });
}

/** IDs of trips the user has archived (hidden from the active list). */
export function archivedTripIds(): Set<string> {
  const store = load();
  return new Set(
    Object.entries(store)
      .filter(([, v]) => !!v.archivedAt)
      .map(([id]) => id)
  );
}
