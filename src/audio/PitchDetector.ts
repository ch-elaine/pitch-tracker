/** Fundamental-frequency estimation via the McLeod Pitch Method (pitchy),
 *  wrapped behind our own interface so the algorithm stays swappable.
 *  Pure DSP — returns Hz or null, never touches the DOM. */

import { PitchDetector as Pitchy } from 'pitchy';

export class PitchDetector {
  private readonly detector: Pitchy<Float32Array>;

  constructor(
    fftSize: number,
    private readonly clarityThreshold = 0.85,
    private readonly minHz = 60,
    private readonly maxHz = 1000,
  ) {
    this.detector = Pitchy.forFloat32Array(fftSize);
  }

  /** Returns F0 in Hz, or null when the frame is too unvoiced/quiet to trust. */
  detect(frame: Float32Array, sampleRate: number): number | null {
    const [hz, clarity] = this.detector.findPitch(frame, sampleRate);
    if (clarity < this.clarityThreshold) return null;
    if (hz < this.minHz || hz > this.maxHz) return null; // reject octave errors / hiss
    return hz;
  }
}
