// ESLint 9 flat config. Uses the typescript-eslint plugin's own presets, so no
// dependency beyond the two @typescript-eslint packages already installed.
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  ...tsPlugin.configs["flat/recommended"],
  {
    files: ["src/**/*.ts"],
    rules: {
      // `_`-prefixed names mark an argument kept for a signature's sake.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
