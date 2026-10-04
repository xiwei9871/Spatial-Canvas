import { defineConfig } from 'vite';

export default defineConfig({
  root: 'apps/workspace',
  publicDir: '../../examples',
  build: { outDir: '../../dist', emptyOutDir: true },
});
