const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "data/**",
      "backups/**",
      "coverage/**",
      "dist/**",
      "build/**",
    ],
  },
  {
    files: [
      "src/**/*.{js,cjs,mjs}",
      "test/**/*.{js,cjs,mjs}",
      "scripts/**/*.{js,cjs,mjs}",
    ],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-duplicate-imports": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];
