import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Every top-level HTML file is its own entry so existing URLs keep working
// (this is a multi-page app, not an SPA). Add new pages here.
const page = (name: string) => fileURLToPath(new URL(`./${name}.html`, import.meta.url));

export default defineConfig({
  base: '/',
  build: {
    target: 'es2020',
    // The lazily-loaded Three.js chunk is legitimately ~600 kB minified.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        home: page('index'),
        sixsevenvr: page('sixsevenvr'),
        tgsvr: page('tgsvr'),
        sixsevenprivacy: page('sixsevenprivacypolicy'),
        sixseventerms: page('sixseventermsofservice'),
        tgsvrprivacy: page('tgsvrprivacypolicy'),
        tgsvrterms: page('tgsvrtermsofservice'),
      },
    },
  },
});
