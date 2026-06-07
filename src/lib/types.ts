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
  /** Underlying data for the transparency graphs. Omitted from persisted records
   *  (the raw per-frame samples would bloat storage); present for live display. */
  breakdown?: GenderBreakdown;
}

/** The raw inputs behind a GenderResult, surfaced for user transparency. */
export interface GenderBreakdown {
  /** Every voiced per-frame F0 (Hz) that fed the median. */
  f0Samples: number[];
  /** -1..+1 sub-score from pitch alone. */
  f0Score: number;
  /** -1..+1 sub-score from formants, when available. */
  formantScore?: number;
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
