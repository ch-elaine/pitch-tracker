/** Scrolling volume graph (filled area) on a linear dBFS Y axis with gridline
 *  labels and a hover crosshair/tooltip. Render-only; the controller pushes
 *  per-frame dBFS values and calls render(); hovering also triggers render. */

import { ResponsiveCanvas } from './ResponsiveCanvas';
import { GraphPointer, HoverTooltip } from './interaction';
import type { Palette } from './palette';

const FLOOR_DB = -60;
const CEIL_DB = 0;
const CAPACITY = 600;
const GRID_DB = [0, -20, -40, -60];

export class VolumeGraph {
  private readonly canvas: ResponsiveCanvas;
  private readonly pointer: GraphPointer;
  private readonly tooltip: HoverTooltip;
  private readonly values: number[] = [];
  /** See PitchGraph: fit-to-width for preview vs. scrolling window for live. */
  private fitMode = false;

  constructor(canvasEl: HTMLCanvasElement, private readonly palette: Palette) {
    this.canvas = new ResponsiveCanvas(canvasEl, () => this.render());
    const container = canvasEl.parentElement ?? canvasEl;
    this.tooltip = new HoverTooltip(container);
    this.pointer = new GraphPointer(canvasEl, () => this.render());
  }

  push(db: number): void {
    this.fitMode = false;
    const clamped = Number.isFinite(db) ? Math.max(FLOOR_DB, Math.min(CEIL_DB, db)) : FLOOR_DB;
    this.values.push(clamped);
    if (this.values.length > CAPACITY) this.values.shift();
  }

  /** Replace the buffer with a complete series and render it scaled to width. */
  loadSeries(values: number[]): void {
    this.values.length = 0;
    for (const db of values) {
      this.values.push(Number.isFinite(db) ? Math.max(FLOOR_DB, Math.min(CEIL_DB, db)) : FLOOR_DB);
    }
    this.fitMode = true;
    this.render();
  }

  clear(): void {
    this.values.length = 0;
    this.fitMode = false;
    this.tooltip.hide();
    this.canvas.clear();
  }

  private yForDb(db: number): number {
    const t = (db - FLOOR_DB) / (CEIL_DB - FLOOR_DB);
    return this.canvas.height * (1 - Math.max(0, Math.min(1, t)));
  }

  render(): void {
    const { ctx, width, height } = this.canvas;
    const colors = this.palette.current;
    this.canvas.clear();

    // dBFS gridlines + labels.
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = colors.baseContent;
    ctx.globalAlpha = 0.55;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const db of GRID_DB) {
      const y = Math.round(this.yForDb(db)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(`${db}`, 2, y);
    }
    ctx.globalAlpha = 1;

    const n = this.values.length;
    const step = width / ((this.fitMode ? Math.max(2, n) : CAPACITY) - 1);

    if (n >= 2) {
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 0; i < n; i++) ctx.lineTo(i * step, this.yForDb(this.values[i] ?? FLOOR_DB));
      ctx.lineTo((n - 1) * step, height);
      ctx.closePath();
      ctx.fillStyle = colors.primary;
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = i * step;
        const y = this.yForDb(this.values[i] ?? FLOOR_DB);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    this.drawHover(step, height, colors.primary, colors.baseContent);
  }

  private drawHover(step: number, height: number, accent: string, lineColor: string): void {
    const px = this.pointer.x;
    if (px == null) {
      this.tooltip.hide();
      return;
    }
    const index = Math.round(px / step);
    if (index < 0 || index >= this.values.length) {
      this.tooltip.hide();
      return;
    }
    const db = this.values[index] ?? FLOOR_DB;

    const { ctx, width } = this.canvas;
    const x = index * step;
    const y = this.yForDb(db);

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.tooltip.show(`${Math.round(db)} dBFS`, x, y - 14, { width, height });
  }
}
