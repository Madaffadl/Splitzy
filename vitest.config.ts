/// <reference types="vitest" />
import { defineConfig, configDefaults } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
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
