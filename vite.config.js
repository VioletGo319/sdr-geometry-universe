import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        gallery: resolve(__dirname, 'index.html'),
        lockscreen: resolve(__dirname, 'lockscreen.html'),
      },
    },
  },
});
