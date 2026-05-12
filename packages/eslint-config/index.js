import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default function cuspEslintConfig(opts = {}) {
  const { react = false } = opts;

  const configs = [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      rules: {
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ];

  if (react) {
    configs.push({
      plugins: {
        "react-hooks": reactHooks,
        "react-refresh": reactRefresh,
      },
      rules: {
        ...reactHooks.configs.recommended.rules,
        "react-refresh/only-export-components": [
          "warn",
          { allowConstantExport: true },
        ],
      },
    });
  }

  return configs;
}
