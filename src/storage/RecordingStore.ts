/** IndexedDB-backed persistence for recordings. Blobs are stored directly (not
 *  base64 in localStorage), survive reloads, and are origin-scoped/local-only. */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RecordingStore, StoredRecording } from '../lib/types';

interface PitchTrackerDB extends DBSchema {
  recordings: {
    key: string;
    value: StoredRecording;
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
    await db.put(STORE, rec);
  }

  /** Newest first. */
  async list(): Promise<StoredRecording[]> {
    const db = await this.dbPromise;
    const all = await db.getAllFromIndex(STORE, 'by-createdAt');
    return all.reverse();
  }

  async get(id: string): Promise<StoredRecording | undefined> {
    const db = await this.dbPromise;
    return db.get(STORE, id);
  }

  async delete(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE, id);
  }
}
