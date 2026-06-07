---
name: ui-daisyui-responsive
description: TailwindCSS + DaisyUI setup with Vite, which DaisyUI components to use for this app, and mobile/desktop responsive + accessibility conventions. Read before building any UI, layout, or component.
---

# UI: TailwindCSS + DaisyUI (Responsive)

The UI is built with **TailwindCSS + DaisyUI**. **Prefer DaisyUI components** over
hand-written markup wherever one fits — buttons, cards, progress, stats, alerts,
range, navbar, drawer, theme controller. Hand-roll only when no component fits.

## Setup with Vite

```bash
npm create vite@latest . -- --template vanilla-ts
npm i -D tailwindcss @tailwindcss/vite daisyui
```

DaisyUI 5 + Tailwind 4 — wire the Tailwind Vite plugin in `vite.config.ts`, then
in `src/style.css`:

```css
@import "tailwindcss";
@plugin "daisyui";
```

(If on Tailwind 3, use `tailwind.config.js` with `content` globs and
`plugins: [require('daisyui')]` instead.) Verify the actual installed major
versions before writing config — the two generations differ.

## Layout & responsiveness (mobile-first)

- Design **mobile-first**, enhance up with `sm: md: lg:` breakpoints.
- Single primary column on mobile; on `lg+` use a two-pane layout (controls +
  graphs left, recordings list right) via grid/flex.
- The big **Record button** must be thumb-reachable and large on mobile — center
  it, use `btn btn-lg` / `btn-circle` and a clear recording state (pulsing
  `btn-error` while recording).
- Graphs (canvas) must be **fluid width**: size canvas to its container via
  `ResizeObserver` and `devicePixelRatio` (see [[pitch-detection]]) so they stay
  crisp and reflow on rotation.
- Use `dvh`/`min-h-dvh` (not `vh`) so mobile browser chrome doesn't clip layout.
- Test both portrait phone and wide desktop.

## Component mapping (use these)

| Need | DaisyUI component |
|------|-------------------|
| App header | `navbar` |
| Recordings list / each recording | `card` |
| Record / download / delete actions | `btn`, `btn-circle`, `join` |
| Volume meter | `radial-progress` or `progress` (see [[volume-detection]]) |
| Live note / median F0 / duration | `stat` |
| Gender spectrum membership | `progress` / `radial-progress` (see [[voice-gender-analysis]]) |
| Errors (mic denied, quota, clipping) | `alert` (`alert-error`/`alert-warning`) |
| Encoding / analyzing in progress | `loading`, `progress` |
| Bitrate / settings | `range`, `select`, `toggle` |
| Light/dark theme switch | `theme-controller` |
| Mobile nav / settings panel | `drawer` |
| Empty state ("no recordings yet") | `card` + muted text |

## Theming

- Use DaisyUI themes (e.g. `data-theme="light"`/`"dark"`); offer a
  `theme-controller` toggle. Default to respecting `prefers-color-scheme`.
- **Graphs read DaisyUI colors** from CSS custom properties (`--p` primary,
  `--bc` base-content, `--er` error) so canvases match the active theme — never
  hardcode hex in graph renderers.

## Accessibility

- Record button: `aria-pressed`, clear label that changes ("Start recording" /
  "Stop recording").
- Live region (`aria-live="polite"`) announcing state changes (recording started,
  analysis complete).
- Don't rely on color alone for clipping/gender — pair with text/icons.
- Keyboard: Space/Enter toggles recording; focus-visible rings (DaisyUI provides).
- Respect `prefers-reduced-motion` — disable the pulsing/animation if set.

## Clean-code notes

- Keep render helpers in `src/ui/components/` thin and stateless: take data, return
  or update DOM. Business/audio logic stays out (see [[project-architecture]]).
- Don't sprinkle DOM queries everywhere — pass element refs in, or query once in a
  small view module.
