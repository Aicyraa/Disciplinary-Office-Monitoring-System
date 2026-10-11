import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/generated/**', '.agent-work/**'] },
  {
    files: ['api/**/*.ts', 'client/**/*.{ts,tsx}', 'shared/**/*.ts', '*.config.mjs'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
);
