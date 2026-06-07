/** Estimates the first two vocal-tract formants (F1, F2) from a recorded clip via
 *  Linear Predictive Coding. Pipeline (see voice-gender-analysis skill, Tier 2):
 *
 *    decode → resample to ~11 kHz → pre-emphasis → frame (Hamming) →
 *    autocorrelation → Levinson-Durbin LPC → LPC spectral-envelope peaks → F1/F2
 *
 *  Per-frame formants are aggregated by median across voiced (energetic) frames.
 *  Formants reflect vocal-tract length and complement F0 for voice characterization.
 *  Pure analysis: returns numbers (or null when the clip is too short/quiet). */

export interface FormantEstimate {
  f1: number;
  f2: number;
}

const TARGET_SR = 11025; // formants of interest live below ~3.5 kHz
const FRAME = 512; // ~46 ms at 11 kHz
const HOP = 256;
const PRE_EMPHASIS = 0.97;
const ENERGY_GATE = 0.2; // process frames louder than 20% of the peak frame
const MIN_VOICED_FRAMES = 5;

// Plausible formant search ranges (Hz) for adult speech.
const F1_RANGE: [number, number] = [200, 1100];
const F2_RANGE: [number, number] = [800, 3000];

export class FormantAnalyzer {
  async analyze(blob: Blob): Promise<FormantEstimate | null> {
    const { samples, sampleRate } = await decodeMono(blob);
    if (samples.length < FRAME * 2) return null;

    const signal = preEmphasis(samples);
    const order = Math.min(2 + Math.round(sampleRate / 1000), 30);
    const window = hammingWindow(FRAME);

    // Per-frame RMS to set an energy gate (skip silence/breaths).
    const rms: number[] = [];
    let maxRms = 0;
    for (let start = 0; start + FRAME <= signal.length; start += HOP) {
      let sum = 0;
      for (let i = 0; i < FRAME; i++) {
        const v = signal[start + i] ?? 0;
        sum += v * v;
      }
      const value = Math.sqrt(sum / FRAME);
      rms.push(value);
      if (value > maxRms) maxRms = value;
    }
    if (maxRms === 0) return null;
    const gate = maxRms * ENERGY_GATE;

    const f1s: number[] = [];
    const f2s: number[] = [];
    let frameIndex = 0;
    const frame = new Float64Array(FRAME);
    for (let start = 0; start + FRAME <= signal.length; start += HOP, frameIndex++) {
      if ((rms[frameIndex] ?? 0) < gate) continue;
      for (let i = 0; i < FRAME; i++) frame[i] = (signal[start + i] ?? 0) * (window[i] ?? 0);

      const autocorr = autocorrelation(frame, order);
      if ((autocorr[0] ?? 0) === 0) continue;
      const lpc = levinsonDurbin(autocorr, order);
      const formants = formantsFromLpc(lpc, sampleRate);
      if (formants) {
        f1s.push(formants.f1);
        f2s.push(formants.f2);
      }
    }

    if (f1s.length < MIN_VOICED_FRAMES) return null;
    return { f1: Math.round(median(f1s)), f2: Math.round(median(f2s)) };
  }
}

/** Decode + resample to TARGET_SR, downmixed to mono. */
async function decodeMono(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  // decodeAudioData resamples to the context's sample-rate, so this also resamples.
  const ctx = new OfflineAudioContext(1, 1, TARGET_SR);
  const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      mono[i] = (mono[i] ?? 0) + (data[i] ?? 0) / buffer.numberOfChannels;
    }
  }
  return { samples: mono, sampleRate: buffer.sampleRate };
}

function preEmphasis(x: Float32Array): Float32Array {
  const out = new Float32Array(x.length);
  out[0] = x[0] ?? 0;
  for (let i = 1; i < x.length; i++) out[i] = (x[i] ?? 0) - PRE_EMPHASIS * (x[i - 1] ?? 0);
  return out;
}

function hammingWindow(size: number): Float64Array {
  const w = new Float64Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
  return w;
}

function autocorrelation(x: Float64Array, order: number): Float64Array {
  const r = new Float64Array(order + 1);
  for (let k = 0; k <= order; k++) {
    let sum = 0;
    for (let n = 0; n < x.length - k; n++) sum += (x[n] ?? 0) * (x[n + k] ?? 0);
    r[k] = sum;
  }
  return r;
}

/** Solve the Toeplitz LPC normal equations. Returns A(z) coefficients, a[0] = 1. */
function levinsonDurbin(r: Float64Array, order: number): Float64Array {
  const a = new Float64Array(order + 1);
  a[0] = 1;
  let error = r[0] ?? 0;

  for (let i = 1; i <= order; i++) {
    let acc = r[i] ?? 0;
    for (let j = 1; j < i; j++) acc += (a[j] ?? 0) * (r[i - j] ?? 0);
    const k = error === 0 ? 0 : -acc / error;

    const prev = a.slice(0, i); // a[0..i-1] before this iteration
    for (let j = 1; j < i; j++) a[j] = (prev[j] ?? 0) + k * (prev[i - j] ?? 0);
    a[i] = k;

    error *= 1 - k * k;
    if (error <= 0) break;
  }
  return a;
}

/** Peaks of the LPC spectral envelope (= minima of |A(e^jw)|) → lowest two formants. */
function formantsFromLpc(a: Float64Array, sampleRate: number): FormantEstimate | null {
  const order = a.length - 1;
  const bins = 512;
  const nyquist = sampleRate / 2;
  const mag2 = new Float64Array(bins);

  for (let bin = 0; bin < bins; bin++) {
    const w = (Math.PI * bin) / (bins - 1);
    let re = 0;
    let im = 0;
    for (let j = 0; j <= order; j++) {
      const aj = a[j] ?? 0;
      re += aj * Math.cos(w * j);
      im -= aj * Math.sin(w * j);
    }
    mag2[bin] = re * re + im * im; // envelope peak ⇔ local minimum here
  }

  const peaks: number[] = [];
  for (let bin = 1; bin < bins - 1; bin++) {
    const m = mag2[bin] ?? Infinity;
    if (m < (mag2[bin - 1] ?? Infinity) && m <= (mag2[bin + 1] ?? Infinity)) {
      peaks.push((bin / (bins - 1)) * nyquist);
    }
  }

  const f1 = peaks.find((f) => f >= F1_RANGE[0] && f <= F1_RANGE[1]);
  if (f1 === undefined) return null;
  const f2 = peaks.find((f) => f >= Math.max(f1 + 150, F2_RANGE[0]) && f <= F2_RANGE[1]);
  if (f2 === undefined) return null;
  return { f1, f2 };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return sorted[mid] ?? 0;
}
