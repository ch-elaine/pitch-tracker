/** Scrolling pitch graph on a log-frequency Y axis with octave labels and a
 *  hover crosshair/tooltip. Render-only: the controller pushes per-frame values
 *  and calls render() from the shared rAF loop; hovering also triggers render.
 *  Unvoiced frames are pushed as null and drawn as gaps (not a line to zero). */

import { ResponsiveCanvas } from './ResponsiveCanvas';
import { GraphPointer, HoverTooltip } from './interaction';
import type { Palette } from './palette';
import { midiToHz, hzToNoteName } from '../../lib/notes';

const MIN_HZ = 65; // ~C2
const MAX_HZ = 1000;
const CAPACITY = 600; // scrolling window length in frames

export class PitchGraph {
  private readonly canvas: ResponsiveCanvas;
  private readonly pointer: GraphPointer;
  private readonly tooltip: HoverTooltip;
  private readonly values: (number | null)[] = [];

  constructor(canvasEl: HTMLCanvasElement, private readonly palette: Palette) {
    this.canvas = new ResponsiveCanvas(canvasEl);
    const container = canvasEl.parentElement ?? canvasEl;
    this.tooltip = new HoverTooltip(container);
    this.pointer = new GraphPointer(canvasEl, () => this.render());
  }

  push(hz: number | null): void {
    this.values.push(hz);
    if (this.values.length > CAPACITY) this.values.shift();
  }

  clear(): void {
    this.values.length = 0;
    this.tooltip.hide();
    this.canvas.clear();
  }

  private yForHz(hz: number): number {
    const t = (Math.log2(hz) - Math.log2(MIN_HZ)) / (Math.log2(MAX_HZ) - Math.log2(MIN_HZ));
    return this.canvas.height * (1 - Math.max(0, Math.min(1, t)));
  }

  render(): void {
    const { ctx, width, height } = this.canvas;
    const colors = this.palette.current;
    this.canvas.clear();

    // Octave gridlines + Hz/note labels so the log scale is readable.
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = colors.baseContent;
    ctx.globalAlpha = 0.55;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (let midi = 36; midi <= 84; midi += 12) {
      const hz = midiToHz(midi);
      const y = Math.round(this.yForHz(hz)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(28, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(`${Math.round(hz)}`, 2, y);
    }
    ctx.globalAlpha = 1;

    const n = this.values.length;
    const step = width / (CAPACITY - 1);

    if (n >= 2) {
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

    this.drawHover(step, height, colors.primary, colors.baseContent);
  }

  private drawHover(step: number, height: number, accent: string, lineColor: string): void {
    const px = this.pointer.x;
    if (px == null) {
      this.tooltip.hide();
      return;
    }
    const index = Math.round(px / step);
    const hz = this.values[index];
    if (index < 0 || index >= this.values.length || hz == null) {
      this.tooltip.hide();
      return;
    }

    const { ctx, width } = this.canvas;
    const x = index * step;
    const y = this.yForHz(hz);

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

    this.tooltip.show(`${Math.round(hz)} Hz · ${hzToNoteName(hz)}`, x, y - 14, { width, height });
  }
}
