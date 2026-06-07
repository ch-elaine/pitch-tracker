/** Single source of truth for the recording lifecycle. Views/controller react
 *  to transitions instead of tracking their own booleans. */

export type AppPhase = 'idle' | 'requesting' | 'recording' | 'analyzing' | 'done';

type Listener = (phase: AppPhase) => void;

export class AppState {
  private phase: AppPhase = 'idle';
  private readonly listeners = new Set<Listener>();

  get current(): AppPhase {
    return this.phase;
  }

  set(phase: AppPhase): void {
    if (phase === this.phase) return;
    this.phase = phase;
    for (const listener of this.listeners) listener(phase);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
