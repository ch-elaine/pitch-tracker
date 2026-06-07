/** IndexedDB-backed persistence for recordings. Audio is stored as a raw
 *  `ArrayBuffer` (not a `Blob`) and re-wrapped into a `Blob` on read: WebKit/Safari
 *  has a long-standing bug where `Blob`s put into IndexedDB come back empty or
 *  corrupted, which surfaced as playback/download errors. ArrayBuffers round-trip
 *  reliably everywhere. Records are origin-scoped and local-only. */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RecordingStore, StoredRecording } from '../lib/types';

/** On-disk shape: identical to StoredRecording but with the audio held as bytes.
 *  `blob` is optional to read back legacy records written before this migration. */
interface PersistedRecording {
  id: string;
  name: string;
  createdAt: number;
  data: ArrayBuffer;
  mimeType: string;
  durationMs: number;
  gender?: StoredRecording['gender'];
  /** Legacy records (pre-ArrayBuffer) stored the Blob directly. */
  blob?: Blob;
}

interface PitchTrackerDB extends DBSchema {
  recordings: {
    key: string;
    value: PersistedRecording;
    indexes: { 'by-createdAt': number };
  };
}

const DB_NAME = 'pitch-tracker';
const DB_VERSION = 1;
const STORE = 'recordings';

export class IndexedDbRecordingStore implements RecordingStore {
  private readonly dbPromise: Promise<IDBPDatabase<PitchTrackerDB>>;

  constructor() {
    this.dbPromise = openDB<PitchTrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('by-createdAt', 'createdAt');
      },
    });
  }

  async add(rec: StoredRecording): Promise<void> {
    const db = await this.dbPromise;
    const { blob, ...rest } = rec;
    const persisted: PersistedRecording = { ...rest, data: await blob.arrayBuffer() };
    await db.put(STORE, persisted);
  }

  /** Newest first. */
  async list(): Promise<StoredRecording[]> {
    const db = await this.dbPromise;
    const all = await db.getAllFromIndex(STORE, 'by-createdAt');
    return all.map(toStored).reverse();
  }

  async get(id: string): Promise<StoredRecording | undefined> {
    const db = await this.dbPromise;
    const found = await db.get(STORE, id);
    return found ? toStored(found) : undefined;
  }

  async delete(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE, id);
  }
}

/** Reconstruct the in-memory record, re-wrapping stored bytes into a Blob.
 *  Falls back to a legacy `blob` field for records written before the migration. */
function toStored(p: PersistedRecording): StoredRecording {
  const { data, blob, gender, ...rest } = p;
  const audio = data ? new Blob([data], { type: p.mimeType }) : (blob as Blob);
  return { ...rest, blob: audio, ...(gender ? { gender } : {}) };
}
