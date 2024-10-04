import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginPrettier from "eslint-plugin-prettier"; // Add Prettier plugin
import prettier from "prettier"; // Import Prettier core for formatting options

export default [
  // General configuration for all JavaScript/JSX files
  {
    files: ["**/*.{js,mjs,cjs,jsx,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser, // Add browser globals
        BigInt: "readonly", // Add BigInt as a global variable
      },
      ecmaVersion: "latest", // Use latest ECMAScript version
      sourceType: "module", // Use ES modules
    },
    plugins: { prettier: pluginPrettier }, // Register Prettier as a plugin
    rules: {
      "no-unused-vars": "warn", // Warn about unused variables
      "no-undef": "error", // Error on undefined variables
      "react/react-in-jsx-scope": "off", // No need to import React for JSX in React 17+
      "prettier/prettier": ["error"], // Enforce Prettier formatting rules
      "no-extra-semi": "error", // Auto-fix extra semicolons
      semi: ["error", "always"], // Ensure semicolons
      quotes: ["error", "single"], // Enforce single quotes
    },
  },

  // React plugin configuration
  pluginReact.configs.flat.recommended,

  // Node.js specific configuration (for craco.config.js)
  {
    files: ["craco.config.js"],
    languageOptions: {
      globals: globals.node, // Add Node.js globals (e.g., `module`, `require`)
      ecmaVersion: "latest",
      sourceType: "commonjs", // Use CommonJS modules for Node.js files
    },
    rules: {
      "no-undef": "off", // Turn off undefined errors for `require` and `module`
    },
  },

  // Jest configuration for test files
  {
    files: ["**/__tests__/**", "**/*.{test,spec}.js"],
    languageOptions: {
      globals: globals.jest, // Add Jest globals like `test`, `expect`
    },
    rules: {
      "no-unused-vars": "warn", // Warn about unused variables in test files
    },
  },

  // ESLint core JS recommendations
  pluginJs.configs.recommended,

  // Prettier plugin configuration
  {
    plugins: { prettier: pluginPrettier }, // Register Prettier as a plugin
    rules: {
      "prettier/prettier": [
        "error",
        prettier.resolveConfig, // No 'sync', use the async resolveConfig or remove if not needed
      ],
    },
  },

  // React plugin recommendations (auto-detect React version)
  {
    settings: {
      react: {
        version: "detect", // Auto-detect React version
      },
    },
  },
];
