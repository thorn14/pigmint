import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: { port: 5173, open: true },
  resolve: {
    alias: {
      '@pigmint/core': resolve(here, '../core/src/index.ts'),
    },
  },
});
