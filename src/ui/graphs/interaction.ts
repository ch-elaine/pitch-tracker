/** Shared hover plumbing for the canvas graphs: a pointer tracker and a small
 *  positioned tooltip. The graphs own how a hovered value is formatted/drawn;
 *  these just report the cursor position and render the label. */

/** Tracks the pointer position over a canvas in CSS pixels (null when away). */
export class GraphPointer {
  /** X in CSS px, or null when the pointer is not over the canvas. */
  x: number | null = null;
  y = 0;

  constructor(canvas: HTMLCanvasElement, onChange: () => void) {
    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.x = e.clientX - rect.left;
      this.y = e.clientY - rect.top;
      onChange();
    });
    canvas.addEventListener('pointerleave', () => {
      this.x = null;
      onChange();
    });
  }
}

/** A lightweight tooltip pinned inside a (position: relative) container. */
export class HoverTooltip {
  private readonly el: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className =
      'pointer-events-none absolute z-10 hidden -translate-x-1/2 whitespace-nowrap ' +
      'rounded bg-base-300/90 px-2 py-1 text-xs font-medium shadow';
    container.appendChild(this.el);
  }

  /** Show at (x,y) in container CSS px; coordinates are clamped to stay inside. */
  show(text: string, x: number, y: number, bounds: { width: number; height: number }): void {
    this.el.textContent = text;
    const clampedX = Math.max(28, Math.min(bounds.width - 28, x));
    const clampedY = Math.max(2, Math.min(bounds.height - 26, y));
    this.el.style.left = `${clampedX}px`;
    this.el.style.top = `${clampedY}px`;
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
