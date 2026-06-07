/** Wraps a <canvas> with device-pixel-ratio-aware sizing that tracks its CSS box
 *  via ResizeObserver, so graphs stay crisp on retina/mobile and reflow on
 *  rotation. Drawing code uses `width`/`height` in CSS pixels. */

export class ResponsiveCanvas {
  readonly ctx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;

  /** @param onResize optional redraw hook, fired after the backing store resizes
   *  (e.g. when a collapsed panel becomes visible). */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onResize?: () => void,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context is not available');
    this.ctx = ctx;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  /** The underlying canvas element (for attaching pointer listeners). */
  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  get width(): number {
    return this.cssWidth;
  }

  get height(): number {
    return this.cssHeight;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS-pixel coordinates
    this.onResize?.();
  }
}
