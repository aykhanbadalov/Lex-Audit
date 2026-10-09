import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "playwright-report",
      "test-results",
      "public/mockServiceWorker.js",
      "src/routeTree.gen.ts",
      "src/api/schema.d.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Audit A-06: never render raw HTML; AI output goes through react-markdown + rehype-sanitize.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Raw HTML is not allowed. Use react-markdown with rehype-sanitize.",
        },
      ],
      // Audit A-02: tokens must never be persisted in web storage.
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Use the shared storage helper; never store tokens in web storage." },
        { name: "sessionStorage", message: "Use the shared storage helper; never store tokens in web storage." },
      ],
    },
  },
  {
    files: ["src/routes/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
);
