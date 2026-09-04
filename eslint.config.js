import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // `any` explícito: aviso, no error. Queda visible para irlo tipando, pero no
      // bloquea el CI (hay usos laxos pre-existentes en dashboards y renderers de
      // markdown cuyo tipado correcto arrastra a muchos sitios de uso).
      "@typescript-eslint/no-explicit-any": "warn",
      // @ts-ignore permitido SOLO con descripción: se usa en los params dinámicos
      // de rutas de TanStack, donde el tipo no puede verificarse en compilación.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description", minimumDescriptionLength: 5 },
      ],
    },
  },
  eslintPluginPrettier,
);
