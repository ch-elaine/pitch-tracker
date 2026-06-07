import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// On GitHub Pages (project site) assets are served from /<repo>/.
// Locally and in dev we serve from root. Override REPO_BASE if the repo is renamed.
const repoBase = process.env.REPO_BASE ?? '/pitch-tracker/';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? repoBase : '/',
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Pitch Tracker',
        short_name: 'Pitch Tracker',
        description:
          'Fully client-side pitch & volume detection with in-browser recording, MP3 export, and voice-spectrum analysis.',
        theme_color: '#312e81',
        background_color: '#1d232a',
        display: 'standalone',
        orientation: 'portrait-primary',
        categories: ['music', 'utilities', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app makes no runtime network calls, so precaching the build output
        // is enough for full offline use.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
