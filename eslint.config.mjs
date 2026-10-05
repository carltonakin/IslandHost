import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '.runtime/**', '.tools/**'] },
  js.configs.recommended, ...tseslint.configs.recommended,
  { files: ['tests/**/*.cjs'], languageOptions:{sourceType:'commonjs',globals:{process:'readonly',__dirname:'readonly',fetch:'readonly',AbortSignal:'readonly'}},rules:{'@typescript-eslint/no-require-imports':'off'} },
  { files: ['**/*.{ts,tsx}'], rules: { '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
);
