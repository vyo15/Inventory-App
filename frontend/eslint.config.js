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
  globalIgnores(["dist", "build", "coverage", "assets"]),
  {
    files: ["src/**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      // ESLint core tidak menghitung identifier JSX sebagai variable usage tanpa eslint-plugin-react.
      // PascalCase tetap diabaikan untuk mencegah false positive, tetapi default React import
      // dilarang karena project sudah memakai automatic JSX runtime dari Vite.
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["default"],
              message: "Gunakan automatic JSX runtime atau named imports dari react.",
            },
          ],
        },
      ],
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
  {
    files: ["*.config.js", "vite.config.js", "eslint.config.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.node,
      },
      parserOptions: {
        sourceType: "module",
      },
    },
  },
]);
