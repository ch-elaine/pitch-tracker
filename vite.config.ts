import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// On GitHub Pages (project site) assets are served from /<repo>/.
// Locally and in dev we serve from root. Override REPO_BASE if the repo is renamed.
const repoBase = process.env.REPO_BASE ?? '/pitch-tracker/';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? repoBase : '/',
  plugins: [tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
