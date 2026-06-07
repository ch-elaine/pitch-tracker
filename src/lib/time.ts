/** Time + filename formatting helpers. Single source of truth for the
 *  `dd.mm.yyyy-hh:mm:ss` recording naming convention. */

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Display name for a recording, e.g. `07.06.2026-14:32:09` (local time). */
export function formatRecordingName(d: Date): string {
  return (
    `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}` +
    `-${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}

/** Filesystem-safe variant of a recording name (`:` is illegal on Windows). */
export function toSafeFilename(displayName: string, ext: string): string {
  const safe = displayName.replaceAll(':', '-');
  return `${safe}.${ext.replace(/^\./, '')}`;
}

/** Elapsed milliseconds formatted as `mm:ss` (or `h:mm:ss` past an hour). */
export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}
