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
  {
    // =========================
    // SECTION: Auth Context Fast Refresh Guard - AKTIF / GUARDED
    // Fungsi:
    // - menjaga lint tetap fokus ke issue operasional, sambil menoleransi pola export context/helper auth existing.
    // Hubungan flow aplikasi:
    // - tidak mengubah logic auth; hanya menunda refactor arsitektur file AuthContext ke batch terpisah agar aman.
    // Status:
    // - AKTIF sementara untuk cleanup batch UI consistency.
    // - CLEANUP CANDIDATE: dipindah ke file terpisah jika ada task refactor auth architecture.
    // =========================
    files: ["src/context/AuthContext.jsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
