import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The site lives at zayanandahmed-bit.github.io/aireper/, not at the root of
// the domain, so every built asset URL has to be prefixed with the repo name.
const BASE = '/aireper/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    {
      // GitHub Pages has no server-side rewrite, so a hard refresh on
      // /aireper/services would 404. Pages serves 404.html for anything it
      // can't find, so making that file a copy of index.html hands the
      // request back to the router instead.
      name: 'spa-404-fallback',
      closeBundle() {
        copyFileSync(resolve('dist/index.html'), resolve('dist/404.html'));
      },
    },
  ],
});
