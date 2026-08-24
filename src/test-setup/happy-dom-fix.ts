// Node.js v26 defines `localStorage` and `sessionStorage` on globalThis as
// getter-only accessors (no setter, returns undefined without --localstorage-file).
// vitest's populateGlobal() skips them because they're already in `global` but
// NOT in vitest's hardcoded KEYS list — so happy-dom's Storage never replaces them.
//
// This file runs once per test file in happy-dom mode. We use Object.defineProperty
// (NOT vi.stubGlobal, which vi.restoreAllMocks() would undo in beforeEach) to
// permanently replace the getter with happy-dom's real Storage objects.

if (typeof window !== 'undefined') {
    const win = window as Window & typeof globalThis;

    if (win.localStorage !== undefined) {
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            writable: true,
            value: win.localStorage,
        });
    } else {
        // window.localStorage is also broken — install a manual in-memory Storage
        const makeStorage = () => {
            const store: Record<string, string> = {};
            return {
                getItem: (k: string) => (k in store ? store[k] : null),
                setItem: (k: string, v: string) => { store[k] = String(v); },
                removeItem: (k: string) => { delete store[k]; },
                clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
                get length() { return Object.keys(store).length; },
                key: (i: number) => Object.keys(store)[i] ?? null,
            };
        };
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            writable: true,
            value: makeStorage(),
        });
        Object.defineProperty(globalThis, 'sessionStorage', {
            configurable: true,
            writable: true,
            value: makeStorage(),
        });
    }
}
