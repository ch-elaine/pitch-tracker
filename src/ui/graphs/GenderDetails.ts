/** Transparency panel for the voice-character estimate: renders the actual data
 *  behind the score so the user can see how it was derived —
 *    1. F0 distribution histogram (every voiced frame), banded male/andro/female
 *    2. F1/F2 formants against the masculine→feminine reference ranges
 *    3. Score breakdown: F0 sub-score, formant sub-score, weights, blended result
 *
 *  View-only. All scoring constants come from genderModel.ts (same source the
 *  analyzer uses) so the visuals always match the math. */

import { byId, setVisible } from '../../lib/dom';
import type { GenderResult } from '../../lib/types';
import type { Palette } from './palette';
import { ResponsiveCanvas } from './ResponsiveCanvas';
import { GENDER_MODEL, f0BandThresholds } from '../../audio/genderModel';

const F0_MIN = 70;
const F0_MAX = 320;
const F0_BINS = 48;
const FONT = '10px system-ui, sans-serif';

export class GenderDetails {
  private readonly container = byId('gender-details');
  private readonly hist: ResponsiveCanvas;
  private readonly formantCanvas: ResponsiveCanvas;
  private readonly scoreCanvas: ResponsiveCanvas;
  private result: GenderResult | null = null;

  constructor(private readonly palette: Palette) {
    this.hist = new ResponsiveCanvas(byId<HTMLCanvasElement>('f0-hist-canvas'), () =>
      this.drawHistogram(),
    );
    this.formantCanvas = new ResponsiveCanvas(byId<HTMLCanvasElement>('formant-canvas'), () =>
      this.drawFormants(),
    );
    this.scoreCanvas = new ResponsiveCanvas(byId<HTMLCanvasElement>('score-canvas'), () =>
      this.drawScores(),
    );
  }

  show(result: GenderResult): void {
    this.result = result;
    setVisible(this.container, true);
    this.drawHistogram();
    this.drawFormants();
    this.drawScores();
  }

  hide(): void {
    this.result = null;
    setVisible(this.container, false);
  }

  // ---- 1. Pitch distribution histogram -------------------------------------
  private drawHistogram(): void {
    if (!this.result?.breakdown) return;
    const { ctx, width, height } = this.hist;
    const c = this.palette.current;
    this.hist.clear();

    const samples = this.result.breakdown.f0Samples;
    const counts = new Array<number>(F0_BINS).fill(0);
    for (const hz of samples) {
      if (hz < F0_MIN || hz > F0_MAX) continue;
      const idx = Math.min(F0_BINS - 1, Math.floor(((hz - F0_MIN) / (F0_MAX - F0_MIN)) * F0_BINS));
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
    const maxCount = Math.max(1, ...counts);
    const { maleMax, femaleMin } = f0BandThresholds();

    const axisH = 14;
    const topPad = 14;
    const bottom = height - axisH;
    const plotH = bottom - topPad;
    const xForHz = (hz: number): number => ((hz - F0_MIN) / (F0_MAX - F0_MIN)) * width;
    const binW = width / F0_BINS;

    // Bars colored by which band their center falls in.
    for (let i = 0; i < F0_BINS; i++) {
      const count = counts[i] ?? 0;
      if (count === 0) continue;
      const center = F0_MIN + ((i + 0.5) / F0_BINS) * (F0_MAX - F0_MIN);
      ctx.fillStyle = center < maleMax ? c.info : center < femaleMin ? c.secondary : c.accent;
      const barH = (count / maxCount) * plotH;
      ctx.fillRect(i * binW + 0.5, bottom - barH, binW - 1, barH);
    }

    // Median line + label.
    const mx = xForHz(this.result.medianF0);
    ctx.strokeStyle = c.baseContent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, topPad - 4);
    ctx.lineTo(mx, bottom);
    ctx.stroke();
    ctx.fillStyle = c.baseContent;
    ctx.font = FONT;
    ctx.textBaseline = 'top';
    ctx.textAlign = mx > width - 70 ? 'right' : 'left';
    ctx.fillText(`median ${this.result.medianF0} Hz`, mx + (mx > width - 70 ? -4 : 4), 0);

    // Hz axis labels.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.globalAlpha = 0.6;
    for (const hz of [100, 150, 200, 250, 300]) {
      ctx.fillText(`${hz}`, xForHz(hz), height);
    }
    ctx.globalAlpha = 1;
  }

  // ---- 2. Formants vs typical ranges ---------------------------------------
  private drawFormants(): void {
    if (!this.result) return;
    const { ctx, width, height } = this.formantCanvas;
    const c = this.palette.current;
    this.formantCanvas.clear();

    const formants = this.result.formants;
    ctx.font = FONT;
    if (!formants) {
      ctx.fillStyle = c.baseContent;
      ctx.globalAlpha = 0.6;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Formants unavailable for this clip (too short or noisy).', width / 2, height / 2);
      ctx.globalAlpha = 1;
      return;
    }

    const tracks = [
      { name: 'F1', value: formants.f1, center: GENDER_MODEL.f1Center, min: 250, max: 1050 },
      { name: 'F2', value: formants.f2, center: GENDER_MODEL.f2Center, min: 900, max: 2500 },
    ];
    const x0 = 26;
    const x1 = width - 8;
    const trackH = height / tracks.length;

    tracks.forEach((t, i) => {
      const cy = i * trackH + trackH / 2;
      const xFor = (v: number): number =>
        x0 + ((Math.max(t.min, Math.min(t.max, v)) - t.min) / (t.max - t.min)) * (x1 - x0);

      // Masculine→feminine gradient band.
      const grad = ctx.createLinearGradient(x0, 0, x1, 0);
      grad.addColorStop(0, c.info);
      grad.addColorStop(1, c.accent);
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(x0, cy - 5, x1 - x0, 10);
      ctx.globalAlpha = 1;

      // "Typical split" tick at the model center.
      const cxCenter = xFor(t.center);
      ctx.strokeStyle = c.baseContent;
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cxCenter, cy - 8);
      ctx.lineTo(cxCenter, cy + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Measured marker + label.
      const mxv = xFor(t.value);
      ctx.fillStyle = c.primary;
      ctx.beginPath();
      ctx.arc(mxv, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = c.baseContent;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(t.name, 2, cy);
      ctx.textAlign = mxv > width - 50 ? 'right' : 'left';
      ctx.fillText(`${t.value} Hz`, mxv + (mxv > width - 50 ? -6 : 6), cy - 10);
    });

    // Endpoint hints.
    ctx.globalAlpha = 0.5;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText('masculine', x0, height);
    ctx.textAlign = 'right';
    ctx.fillText('feminine', x1, height);
    ctx.globalAlpha = 1;
  }

  // ---- 3. Score breakdown --------------------------------------------------
  private drawScores(): void {
    if (!this.result?.breakdown) return;
    const { ctx, width, height } = this.scoreCanvas;
    const c = this.palette.current;
    this.scoreCanvas.clear();

    const hasFormant = this.result.breakdown.formantScore !== undefined;
    const rows = [
      {
        label: hasFormant ? `Pitch ×${GENDER_MODEL.f0Weight}` : 'Pitch',
        score: this.result.breakdown.f0Score,
        bold: false,
      },
      ...(hasFormant
        ? [
            {
              label: `Formants ×${(1 - GENDER_MODEL.f0Weight).toFixed(1)}`,
              score: this.result.breakdown.formantScore ?? 0,
              bold: false,
            },
          ]
        : []),
      { label: 'Combined', score: this.result.score, bold: true },
    ];

    const labelW = 78;
    const x0 = labelW;
    const x1 = width - 10;
    const centerX = (x0 + x1) / 2;
    const half = (x1 - x0) / 2;
    const xForScore = (s: number): number => centerX + Math.max(-1, Math.min(1, s)) * half;

    // Header: poles.
    ctx.font = FONT;
    ctx.fillStyle = c.baseContent;
    ctx.globalAlpha = 0.6;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('Male', x0, 0);
    ctx.textAlign = 'center';
    ctx.fillText('Androgynous', centerX, 0);
    ctx.textAlign = 'right';
    ctx.fillText('Female', x1, 0);
    ctx.globalAlpha = 1;

    // Zero axis.
    const topPad = 14;
    ctx.strokeStyle = c.grid;
    ctx.beginPath();
    ctx.moveTo(centerX, topPad);
    ctx.lineTo(centerX, height);
    ctx.stroke();

    const rowH = (height - topPad) / rows.length;
    rows.forEach((row, i) => {
      const cy = topPad + i * rowH + rowH / 2;
      const sx = xForScore(row.score);
      const color = row.bold ? c.primary : c.baseContent;

      // lollipop from center to score.
      ctx.strokeStyle = color;
      ctx.globalAlpha = row.bold ? 1 : 0.7;
      ctx.lineWidth = row.bold ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, cy);
      ctx.lineTo(sx, cy);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, cy, row.bold ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Row label + value.
      ctx.fillStyle = c.baseContent;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = row.bold ? `600 ${FONT}` : FONT;
      ctx.fillText(row.label, 2, cy);
      ctx.textAlign = sx > centerX ? 'left' : 'right';
      ctx.fillText(row.score.toFixed(2), sx + (sx > centerX ? 7 : -7), cy);
    });
  }
}
