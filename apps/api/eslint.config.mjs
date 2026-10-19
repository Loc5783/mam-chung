import tseslint from "typescript-eslint";
export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/modules/admin/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/finance/**",
                "**/shared/**",
                "**/tasks/**",
                "**/fitness/**",
                "**/planning/**",
                "**/dashboard/**",
                "../finance/**",
                "../shared/**",
                "../tasks/**",
                "../fitness/**",
                "../planning/**",
                "../dashboard/**",
              ],
              message:
                "Module admin tuyệt đối không được truy cập dữ liệu cá nhân của người dùng.",
            },
          ],
        },
      ],
    },
  },
);
