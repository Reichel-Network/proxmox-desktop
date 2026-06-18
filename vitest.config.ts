/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/renderer/setup.ts'],
    include: ['./tests/renderer/**/*.{test,spec}.{ts,tsx}'],
    alias: [
      {
        find: /^\.\.\/src\/renderer\/(.*)$/,
        replacement: path.resolve(__dirname, './src/renderer/$1.tsx'),
      },
    ],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
});
