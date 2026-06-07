/** Temporal smoothing for the per-frame pitch stream so the live readout/graph
 *  don't strobe or blank on every micro-pause. Two effects:
 *
 *   1. Median over a short rolling window — rejects frame-to-frame jitter and
 *      one-off octave errors without the lag of a long average.
 *   2. Hold — keeps the last stable value through brief unvoiced gaps (natural
 *      breaths/consonants) instead of dropping straight to empty.
 *
 *  Pure logic, no DOM. Feed it raw detections; use the result for display only —
 *  gender analysis should keep consuming the RAW pitch so held/duplicated values
 *  don't bias the median. */

export class PitchStabilizer {
  private readonly window: number[] = [];
  private nullStreak = 0;
  private last: number | null = null;

  /**
   * @param windowSize frames kept for the median (~16ms each; 6 ≈ 100ms).
   * @param holdFrames  consecutive unvoiced frames to bridge (12 ≈ 200ms).
   */
  constructor(
    private readonly windowSize = 6,
    private readonly holdFrames = 12,
  ) {}

  push(hz: number | null): number | null {
    if (hz === null) {
      this.nullStreak++;
      // Bridge short gaps with the last stable value; give up after the hold.
      if (this.nullStreak <= this.holdFrames && this.last !== null) return this.last;
      this.window.length = 0;
      this.last = null;
      return null;
    }

    this.nullStreak = 0;
    this.window.push(hz);
    if (this.window.length > this.windowSize) this.window.shift();
    this.last = median(this.window);
    return this.last;
  }

  reset(): void {
    this.window.length = 0;
    this.nullStreak = 0;
    this.last = null;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return sorted[mid] ?? 0;
}
