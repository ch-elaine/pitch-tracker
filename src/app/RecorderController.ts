/** Orchestrates the recording lifecycle: starts capture, runs the single
 *  per-frame analysis loop (pitch + volume + gender accumulation), and on stop
 *  scores the voice, persists the recording, and refreshes the UI.
 *
 *  Depends only on abstractions/views passed in — no DSP math or DOM lives here
 *  (Dependency Inversion / Single Responsibility, see project-architecture). */

import type { AudioCapture } from '../audio/AudioCapture';
import { CaptureError } from '../audio/AudioCapture';
import type { PitchDetector } from '../audio/PitchDetector';
import type { PitchStabilizer } from '../audio/PitchStabilizer';
import type { VolumeMeter } from '../audio/VolumeMeter';
import type { GenderAnalyzer } from '../audio/GenderAnalyzer';
import type { FormantAnalyzer } from '../audio/FormantAnalyzer';
import type { Mp3Encode, RecordingStore, StoredRecording } from '../lib/types';
import type { AppState } from './AppState';
import type { RecorderView } from '../ui/RecorderView';
import type { PitchGraph } from '../ui/graphs/PitchGraph';
import type { VolumeGraph } from '../ui/graphs/VolumeGraph';
import type { GenderGauge } from '../ui/graphs/GenderGauge';
import type { RecordingsList } from '../ui/RecordingsList';
import { hzToNoteName } from '../lib/notes';
import { formatRecordingName, toSafeFilename } from '../lib/time';
import { downloadBlob } from '../lib/download';

export interface RecorderDeps {
  capture: AudioCapture;
  pitch: PitchDetector;
  stabilizer: PitchStabilizer;
  volume: VolumeMeter;
  gender: GenderAnalyzer;
  formant: FormantAnalyzer;
  store: RecordingStore;
  encodeMp3: Mp3Encode;
  state: AppState;
  view: RecorderView;
  pitchGraph: PitchGraph;
  volumeGraph: VolumeGraph;
  gauge: GenderGauge;
  list: RecordingsList;
  notify: (message: string, kind?: 'info' | 'success' | 'warning' | 'error') => void;
}

/** How often the numeric readouts refresh (ms). The graphs render every frame;
 *  the text updates slower so the digits are readable instead of strobing. */
const STAT_UPDATE_MS = 100;

export class RecorderController {
  private rafId = 0;
  private startedAt = new Date();
  private lastStatAt = 0;

  constructor(private readonly d: RecorderDeps) {}

  /** Wire the UI and load any previously stored recordings. */
  async init(): Promise<void> {
    this.d.view.bindToggle(() => void this.toggle());
    this.d.list.render(await safe(() => this.d.store.list(), []));
  }

  private async toggle(): Promise<void> {
    const phase = this.d.state.current;
    if (phase === 'recording') await this.stop();
    else if (phase === 'idle' || phase === 'done') await this.start();
    // ignore presses during requesting/analyzing
  }

  private async start(): Promise<void> {
    this.d.state.set('requesting');
    this.resetForNewTake();

    try {
      await this.d.capture.start();
    } catch (err) {
      this.handleStartError(err);
      return;
    }

    this.startedAt = new Date();
    this.d.state.set('recording');
    this.d.view.setState('recording');
    this.loop();
  }

  /** Single rAF loop driving all live analysis + graphs (see audio-capture). */
  private loop = (): void => {
    const frame = this.d.capture.readFrame();
    const sampleRate = this.d.capture.sampleRate;

    const rawHz = this.d.pitch.detect(frame, sampleRate);
    const hz = this.d.stabilizer.push(rawHz); // smoothed + gap-bridged for display
    const vol = this.d.volume.measure(frame);

    // Gender uses the RAW stream so held/duplicated values don't bias the median.
    this.d.gender.collect(rawHz);

    // Graphs render every frame for smoothness, on the stabilized pitch.
    this.d.pitchGraph.push(hz);
    this.d.volumeGraph.push(vol.db);
    this.d.pitchGraph.render();
    this.d.volumeGraph.render();

    // Numeric readouts refresh on a slower cadence so the digits stay readable.
    const now = this.d.capture.elapsedMs();
    if (now - this.lastStatAt >= STAT_UPDATE_MS) {
      this.lastStatAt = now;
      this.d.view.updateTime(now);
      this.d.view.updatePitch(hz, hz === null ? null : hzToNoteName(hz));
      this.d.view.updateVolume(vol.db, vol.percent, vol.clipping);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private async stop(): Promise<void> {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.d.state.set('analyzing');
    this.d.view.setState('idle');
    this.d.view.setStatus('Analyzing…');

    let result;
    try {
      result = await this.d.capture.stop();
    } catch {
      this.d.notify('Recording failed to finalize.', 'error');
      this.cleanupAfterStop();
      return;
    }

    // Estimate formants (Tier 2) from the recorded clip, then score the voice.
    const formants = await safe(() => this.d.formant.analyze(result.blob), null);
    const gender = this.d.gender.analyze(formants);
    if (gender) this.d.gauge.show(gender);
    else this.d.gauge.showInsufficient();

    const recording: StoredRecording = {
      id: crypto.randomUUID(),
      name: formatRecordingName(this.startedAt),
      createdAt: this.startedAt.getTime(),
      blob: result.blob,
      mimeType: result.mimeType,
      durationMs: result.durationMs,
      ...(gender ? { gender } : {}),
    };

    try {
      await this.d.store.add(recording);
      this.d.list.render(await this.d.store.list());
    } catch (err) {
      this.d.notify(
        err instanceof DOMException && err.name === 'QuotaExceededError'
          ? 'Storage is full — delete some recordings and try again.'
          : 'Could not save the recording locally.',
        'error',
      );
    }

    this.cleanupAfterStop();
    this.d.state.set('done');
  }

  /** Encode a stored recording to MP3 and trigger download. */
  async download(id: string): Promise<void> {
    const rec = await this.d.store.get(id);
    if (!rec) return;
    try {
      const mp3 = await this.d.encodeMp3(rec.blob);
      downloadBlob(mp3, toSafeFilename(rec.name, 'mp3'));
    } catch {
      this.d.notify('Could not encode this recording to MP3.', 'error');
    }
  }

  async remove(id: string): Promise<void> {
    await this.d.store.delete(id);
    this.d.list.render(await this.d.store.list());
  }

  private resetForNewTake(): void {
    this.lastStatAt = 0;
    this.d.gender.reset();
    this.d.stabilizer.reset();
    this.d.volume.reset();
    this.d.pitchGraph.clear();
    this.d.volumeGraph.clear();
    this.d.gauge.hide();
    this.d.view.resetLive();
  }

  private cleanupAfterStop(): void {
    this.d.capture.dispose();
    this.d.view.setStatus('Ready to record');
  }

  private handleStartError(err: unknown): void {
    const message =
      err instanceof CaptureError ? err.message : 'Could not start recording.';
    this.d.notify(message, 'error');
    this.d.capture.dispose();
    this.d.view.setState('idle');
    this.d.state.set('idle');
  }
}

/** Run an async producer, returning a fallback if it throws (e.g. DB blocked). */
async function safe<T>(producer: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await producer();
  } catch {
    return fallback;
  }
}
