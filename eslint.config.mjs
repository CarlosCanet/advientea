import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import perfectionist from "eslint-plugin-perfectionist";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  perfectionist.configs["recommended-natural"],
  {
    rules: {
      // Declaration order inside a module or a class tells a story; keep it hand-ordered.
      "perfectionist/sort-classes": "off",
      "perfectionist/sort-imports": ["error", { newlinesBetween: 1 }],
      "perfectionist/sort-modules": "off",
      // A blank line or a comment inside an object starts a new block, so meaningful groupings survive sorting.
      "perfectionist/sort-interfaces": ["error", { partitionByComment: true, partitionByNewLine: true }],
      "perfectionist/sort-object-types": ["error", { partitionByComment: true, partitionByNewLine: true }],
      "perfectionist/sort-objects": ["error", { partitionByComment: true, partitionByNewLine: true }],
    },
  },
  // Must come last: turns off every rule that would fight Prettier's formatting.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Additional ignores:
    "node_modules/**",
    "coverage/**",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
