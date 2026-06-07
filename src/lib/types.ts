/** Shared interfaces. Keeping contracts narrow lets the controller depend on
 *  abstractions rather than concrete classes (Dependency Inversion). */

/** Continuous voice-character estimate from the recording's acoustic statistics. */
export interface GenderResult {
  /** -1 = masculine-typical … 0 = androgynous … +1 = feminine-typical. */
  score: number;
  label: 'Male' | 'Androgynous' | 'Female';
  /** 0..1 — based on voiced-frame count, pitch dispersion, and F0/formant agreement. */
  confidence: number;
  /** Median fundamental frequency (Hz) across voiced frames. */
  medianF0: number;
  /** Which signals contributed to the score. */
  method: 'f0' | 'f0+formants';
  /** Median formant frequencies (Hz), present when formant analysis succeeded. */
  formants?: { f1: number; f2: number };
}

/** A recording persisted in the browser. */
export interface StoredRecording {
  id: string;
  /** Display name in `dd.mm.yyyy-hh:mm:ss` format (see lib/time.ts). */
  name: string;
  createdAt: number;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  gender?: GenderResult;
}

/** Persistence contract for recordings (implemented over IndexedDB). */
export interface RecordingStore {
  add(rec: StoredRecording): Promise<void>;
  list(): Promise<StoredRecording[]>;
  get(id: string): Promise<StoredRecording | undefined>;
  delete(id: string): Promise<void>;
}

/** Encodes a recorded audio blob to an MP3 blob (client-side). */
export type Mp3Encode = (blob: Blob, kbps?: number) => Promise<Blob>;
