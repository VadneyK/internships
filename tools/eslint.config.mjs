// Lint config for assets/js, used only by tests/lint.test.mjs (it lives in tools/, so the deploy never ships it).
// Bug classes only, no style rules: a name that is not defined, a second declaration that silently wins, dead code
// after a return, a duplicate key, and the like. Added 2026-10-15 after a one-off pass found a function declared twice.
import globals from "globals";

export default [
  {
    files: ["assets/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: { ...globals.browser, module: "readonly", define: "readonly" },
    },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "no-undef": "error",
      "no-redeclare": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "no-cond-assign": "error",
      "no-fallthrough": "error",
      "no-unsafe-negation": "error",
      "no-sparse-arrays": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
    },
  },
  {
    // the street map is the one page script loaded as a module (it imports the vendored MapLibre build)
    files: ["assets/js/map-gl.js"],
    languageOptions: { sourceType: "module" },
  },
];
