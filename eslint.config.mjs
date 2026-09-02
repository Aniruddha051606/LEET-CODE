import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint 10 flat config.
 *
 * eslint-config-next 16 exports flat config arrays directly, so there is no need for
 * the FlatCompat shim (which does not survive ESLint 10).
 */
const config = [
  {
    ignores: [".next/**", "node_modules/**", "src/generated/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Strong typing is a project requirement, not a suggestion.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];

export default config;
