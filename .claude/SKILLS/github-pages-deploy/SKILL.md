---
name: github-pages-deploy
description: Building the Vite app as static files and deploying to GitHub Pages, including the base-path gotcha and a GitHub Actions workflow. Read before configuring the build, base path, or deployment.
---

# GitHub Pages Deploy

The app is **fully static** — `vite build` emits `dist/` (HTML/JS/CSS/assets) with
no server. GitHub Pages serves it over HTTPS, which is required for `getUserMedia`
(see [[audio-capture]]).

## The base-path gotcha (most common breakage)

Project Pages are served from `https://<user>.github.io/<repo>/`, so asset URLs
must be prefixed with the repo name or everything 404s.

In `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
export default defineConfig({
  // '/<repo-name>/' for project pages; '/' for a user/org page or custom domain.
  base: process.env.GITHUB_ACTIONS ? '/pitch-tracker/' : '/',
});
```

If using a **custom domain** or a `<user>.github.io` repo, set `base: '/'`.

## GitHub Actions workflow (recommended)

`.github/workflows/deploy.yml` — builds on push to `main` and publishes via the
Pages action (no `gh-pages` branch needed):

```yaml
name: Deploy to GitHub Pages
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - id: deploy
        uses: actions/deploy-pages@v4
```

Then in the repo: **Settings → Pages → Source: GitHub Actions**.

## Static-correctness checklist

- [ ] No runtime fetches to any origin — everything bundled (lamejs, pitchy, etc.).
- [ ] `base` matches the deployment URL (test the built `dist/` locally with
      `npx vite preview` before pushing).
- [ ] All asset references are relative/base-aware (use Vite imports, not absolute
      `/foo.js` paths).
- [ ] HTTPS confirmed (Pages is HTTPS) so the mic works in production.
- [ ] `.nojekyll` isn't needed with the Pages artifact flow, but add an empty one
      if any asset path starts with `_`.

## Local verification

```bash
npm run build
npm run preview   # serves dist/ — click through record/download to confirm
```
Recording over `localhost` works (secure context); confirm the full flow
(record → live graphs → gender gauge → save → MP3 download) on the built output,
not just the dev server.
