import { defineConfig } from 'vitest/config';

// GitHub Pages serve o site em https://<user>.github.io/projeto-kage/
export default defineConfig({
  base: '/projeto-kage/',
  build: {
    chunkSizeWarningLimit: 2000, // Phaser é grande por natureza
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
