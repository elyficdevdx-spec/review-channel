import { defineConfig, globalIgnores } from "eslint/config";
import a from "eslint-config-next/core-web-vitals";
import b from "eslint-config-next/typescript";
export default defineConfig([
  ...a,
  ...b,
  globalIgnores([".next/**", "next-env.d.ts"]),
]);
