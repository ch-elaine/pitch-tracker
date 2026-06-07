/** Reads DaisyUI theme colors from CSS custom properties so canvas graphs match
 *  the active theme. Caches values and refreshes on the `themechange` event
 *  (dispatched by ui/theme.ts) rather than re-reading getComputedStyle per frame. */

interface Colors {
  primary: string;
  baseContent: string;
  error: string;
  grid: string;
}

const FALLBACK: Colors = {
  primary: '#570df8',
  baseContent: '#1f2937',
  error: '#ef4444',
  grid: 'rgba(128,128,128,0.18)',
};

export class Palette {
  private colors: Colors = { ...FALLBACK };

  constructor() {
    this.refresh();
    window.addEventListener('themechange', () => this.refresh());
  }

  get current(): Readonly<Colors> {
    return this.colors;
  }

  private refresh(): void {
    const cs = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string): string => {
      const v = cs.getPropertyValue(name).trim();
      return v || fallback;
    };
    this.colors = {
      primary: read('--color-primary', FALLBACK.primary),
      baseContent: read('--color-base-content', FALLBACK.baseContent),
      error: read('--color-error', FALLBACK.error),
      grid: FALLBACK.grid,
    };
  }
}
