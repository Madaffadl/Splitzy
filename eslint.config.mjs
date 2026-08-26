// ESLint flat config (ESLint 9+, eslint-config-next 16+).
// `next lint` was removed in Next 16; lint via `eslint .` directly.

import next from "eslint-config-next";

const config = [
  ...next,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "prisma/migrations/**",
      "next-env.d.ts",
      // Installed AI skill assets (see .gitignore). It ships a handful of .cjs
      // helper scripts, and linting CommonJS from outside the app breaks
      // eslint-config-next's plugin resolution — "could not find plugin react".
      // Not our source either way. Note ESLint does not read .gitignore, so
      // this has to be listed explicitly.
      ".claude/**",
    ],
  },
  {
    rules: {
      // Stylistic, not a correctness issue — keep as warning.
      "react/no-unescaped-entities": "warn",
      // New aggressive rule in eslint-plugin-react-hooks v7 that flags many
      // valid patterns (e.g. lazy-init from localStorage). Off until we do a
      // dedicated effects-cleanup pass.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
