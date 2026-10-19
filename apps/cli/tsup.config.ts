import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  target: 'node18',
  platform: 'node',
  banner: {
    js: `import { createRequire as __shallok_createRequire } from 'node:module';
const require = __shallok_createRequire(import.meta.url);`,
  },
  noExternal: [
    '@shallok/core',
    '@shallok/framework-adapters',
    '@shallok/translation-providers',
    'fast-glob',
  ],
  sourcemap: true,
});
