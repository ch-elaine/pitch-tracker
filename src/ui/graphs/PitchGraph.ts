/** Scrolling pitch graph on a log-frequency Y axis. Render-only: the controller
 *  pushes per-frame values and calls render() from the shared rAF loop.
 *  Unvoiced frames are pushed as null and drawn as gaps (not a line to zero). */

import { ResponsiveCanvas } from './ResponsiveCanvas';
import type { Palette } from './palette';
import { midiToHz } from '../../lib/notes';

const MIN_HZ = 65; // ~C2
const MAX_HZ = 1000;
const CAPACITY = 600; // scrolling window length in frames

export class PitchGraph {
  private readonly canvas: ResponsiveCanvas;
  private readonly values: (number | null)[] = [];

  constructor(canvasEl: HTMLCanvasElement, private readonly palette: Palette) {
    this.canvas = new ResponsiveCanvas(canvasEl);
  }

  push(hz: number | null): void {
    this.values.push(hz);
    if (this.values.length > CAPACITY) this.values.shift();
  }

  clear(): void {
    this.values.length = 0;
    this.canvas.clear();
  }

  private yForHz(hz: number): number {
    const t = (Math.log2(hz) - Math.log2(MIN_HZ)) / (Math.log2(MAX_HZ) - Math.log2(MIN_HZ));
    return this.canvas.height * (1 - Math.max(0, Math.min(1, t)));
  }

  render(): void {
    const { ctx, width } = this.canvas;
    const colors = this.palette.current;
    this.canvas.clear();

    // Octave gridlines (C2..C6) so the log scale is readable.
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let midi = 36; midi <= 84; midi += 12) {
      const y = Math.round(this.yForHz(midiToHz(midi))) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    const n = this.values.length;
    if (n < 2) return;

    const step = width / (CAPACITY - 1);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    let drawing = false;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const hz = this.values[i];
      if (hz == null) {
        drawing = false; // break the line across unvoiced gaps
        continue;
      }
      const x = i * step;
      const y = this.yForHz(hz);
      if (drawing) ctx.lineTo(x, y);
      else {
        ctx.moveTo(x, y);
        drawing = true;
      }
    }
    ctx.stroke();
  }
}
