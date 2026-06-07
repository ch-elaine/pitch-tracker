/** Re-derives the pitch/volume time series and the voice-character result from a
 *  saved recording, by decoding the blob and running the same detectors offline
 *  (frame-by-frame over the PCM instead of the live AnalyserNode). This is how
 *  "Preview" reconstructs the whole page without us having to persist per-frame
 *  data — the audio file is the source of truth. */

import type { GenderResult } from '../lib/types';
import { PitchDetector } from './PitchDetector';
import { PitchStabilizer } from './PitchStabilizer';
import { VolumeMeter } from './VolumeMeter';
import { GenderAnalyzer } from './GenderAnalyzer';
import type { FormantAnalyzer } from './FormantAnalyzer';

export interface PreviewData {
  pitch: (number | null)[];
  volume: number[];
  gender: GenderResult | null;
  /** Representative loudness (median dBFS) for the summary readout. */
  medianDb: number;
}

const SAMPLE_RATE = 48000;
const FFT_SIZE = 2048;
/** Cap the series so the whole clip maps into the graph's display window. */
const MAX_FRAMES = 600;

export class OfflineAnalyzer {
  constructor(private readonly formant: FormantAnalyzer) {}

  async analyze(blob: Blob): Promise<PreviewData> {
    const mono = await decodeMono(blob);

    const detector = new PitchDetector(FFT_SIZE);
    const stabilizer = new PitchStabilizer();
    const meter = new VolumeMeter();
    const gender = new GenderAnalyzer();

    // Choose a hop that keeps the frame count under MAX_FRAMES for long clips.
    const baseHop = Math.floor(FFT_SIZE / 4);
    const usable = Math.max(0, mono.length - FFT_SIZE);
    const possibleFrames = Math.floor(usable / baseHop) + 1;
    const hop =
      possibleFrames <= MAX_FRAMES ? baseHop : Math.max(1, Math.floor(usable / (MAX_FRAMES - 1)));

    const pitch: (number | null)[] = [];
    const volume: number[] = [];
    const frame = new Float32Array(FFT_SIZE);

    for (let start = 0; start + FFT_SIZE <= mono.length; start += hop) {
      frame.set(mono.subarray(start, start + FFT_SIZE));
      const raw = detector.detect(frame, SAMPLE_RATE);
      pitch.push(stabilizer.push(raw));
      volume.push(meter.measure(frame).db);
      gender.collect(raw);
    }

    let formants = null;
    try {
      formants = await this.formant.analyze(blob);
    } catch {
      formants = null;
    }

    return {
      pitch,
      volume,
      gender: gender.analyze(formants),
      medianDb: median(volume),
    };
  }
}

async function decodeMono(blob: Blob): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      mono[i] = (mono[i] ?? 0) + (data[i] ?? 0) / buffer.numberOfChannels;
    }
  }
  return mono;
}

function median(values: number[]): number {
  if (values.length === 0) return -Infinity;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return sorted[mid] ?? 0;
}
