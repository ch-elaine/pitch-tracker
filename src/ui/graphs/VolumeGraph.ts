/** Scrolling volume graph (filled area) on a linear dBFS Y axis. Render-only;
 *  the controller pushes per-frame dBFS values and calls render(). */

import { ResponsiveCanvas } from './ResponsiveCanvas';
import type { Palette } from './palette';

const FLOOR_DB = -60;
const CEIL_DB = 0;
const CAPACITY = 600;

export class VolumeGraph {
  private readonly canvas: ResponsiveCanvas;
  private readonly values: number[] = [];

  constructor(canvasEl: HTMLCanvasElement, private readonly palette: Palette) {
    this.canvas = new ResponsiveCanvas(canvasEl);
  }

  push(db: number): void {
    const clamped = Number.isFinite(db) ? Math.max(FLOOR_DB, Math.min(CEIL_DB, db)) : FLOOR_DB;
    this.values.push(clamped);
    if (this.values.length > CAPACITY) this.values.shift();
  }

  clear(): void {
    this.values.length = 0;
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

    const n = this.values.length;
    if (n < 2) return;

    const step = width / (CAPACITY - 1);

    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let i = 0; i < n; i++) {
      ctx.lineTo(i * step, this.yForDb(this.values[i] ?? FLOOR_DB));
    }
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
}
