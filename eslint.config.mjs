import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { 'no-empty':['error',{allowEmptyCatch:true}], '@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}] } },
  { languageOptions: { globals: { process:'readonly', console:'readonly', window:'readonly', document:'readonly', localStorage:'readonly', Event:'readonly' } } },
  globalIgnores(['.next/**','node_modules/**','playwright-report/**','test-results/**','next-env.d.ts']),
]);
