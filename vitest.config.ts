import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['client/**/*.test.tsx', 'server/**/*.test.ts'],
  },
});
