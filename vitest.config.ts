/// <reference types="vitest" />
import { defineConfig, configDefaults } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        // Node.js v26 defines localStorage as a getter-only accessor on
        // globalThis. vitest's populateGlobal() skips it (already in global,
        // not in KEYS). The setup file re-installs happy-dom's Storage via
        // Object.defineProperty after the environment has initialised.
        setupFiles: ['src/test-setup/happy-dom-fix.ts'],
        // Playwright specs live in e2e/ and use a different runner — keep Vitest
        // from trying to execute them.
        exclude: [...configDefaults.exclude, 'e2e/**'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
