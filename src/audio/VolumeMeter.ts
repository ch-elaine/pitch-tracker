/** Per-frame loudness measurement: RMS -> dBFS with exponential smoothing and
 *  clipping detection. Pure DSP — returns numbers only. */

export interface VolumeReading {
  /** Smoothed loudness in dBFS (<= 0; -Infinity-ish for silence). */
  db: number;
  /** Convenience 0..100 mapping for meters/graphs. */
  percent: number;
  /** True if the frame peaked near full scale (recording is distorted). */
  clipping: boolean;
}

/** Map dBFS to 0..100 over a usable floor (default -60 dBFS). */
export function dbToPercent(db: number, floor = -60): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(100, ((db - floor) / -floor) * 100));
}

export class VolumeMeter {
  private smoothed = -Infinity;

  /** @param attack 0..1 weight given to each new frame (higher = snappier). */
  constructor(private readonly attack = 0.2) {}

  measure(frame: Float32Array): VolumeReading {
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < frame.length; i++) {
      const s = frame[i] ?? 0;
      sumSquares += s * s;
      const abs = Math.abs(s);
      if (abs > peak) peak = abs;
    }
    const rms = Math.sqrt(sumSquares / frame.length);
    const db = 20 * Math.log10(rms || 1e-8);

    this.smoothed =
      this.smoothed === -Infinity ? db : this.smoothed * (1 - this.attack) + db * this.attack;

    return { db: this.smoothed, percent: dbToPercent(this.smoothed), clipping: peak >= 0.99 };
  }

  reset(): void {
    this.smoothed = -Infinity;
  }
}
