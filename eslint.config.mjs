import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // CommonJS shim aliased in via next.config.ts; require() is intentional.
  { ignores: ["lib/buffer-shim.js"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
