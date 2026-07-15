import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], build: { rollupOptions: { input: { index: resolve('desktop/main/index.ts'), 'runtime-entry': resolve('desktop/main/runtime-entry.ts') } } } },
  preload: { plugins: [externalizeDepsPlugin()], build: { rollupOptions: { input: resolve('desktop/preload/bootstrap.ts') } } },
  renderer: {
    root: resolve('desktop/renderer'),
    plugins: [react()],
    build: { rollupOptions: { input: resolve('desktop/renderer/index.html') } },
  },
});
