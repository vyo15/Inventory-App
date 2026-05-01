import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // =========================
  // SECTION: Lint Scope Guard - AKTIF / GUARDED
  // Fungsi:
  // - memastikan lint fokus ke source code aplikasi, bukan artefak build.
  // Hubungan flow aplikasi:
  // - tidak menyentuh business logic, hanya kualitas signal tooling UI/FE.
  // Status:
  // - AKTIF sebagai baseline cleanup batch UI consistency.
  // - GUARDED: daftar ignore ini untuk output generated/build, bukan untuk source app.
  // =========================
  globalIgnores(["dist", "build", "assets"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
    },
  },
]);
