import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['client/**/*.test.tsx', 'server/**/*.test.ts', 'shared/**/*.test.ts', 'drizzle/**/*.test.ts'],
  },
});
