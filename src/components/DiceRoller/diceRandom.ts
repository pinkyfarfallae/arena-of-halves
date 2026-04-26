// Tracks last pick per face count to prevent consecutive identical rolls
const _lastPick = new Map<number, number>();

/**
 * Pick a random face for a die with `faces` sides.
 * Uses crypto.getRandomValues for better entropy than Math.random().
 * Retries once if it matches the previous roll to prevent jarring repeats.
 * Returns a 0-indexed face number (0 to faces-1).
 */
export function rollFace(faces: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  let pick = buf[0] % faces;
  if (pick === _lastPick.get(faces) && faces > 1) {
    crypto.getRandomValues(buf);
    pick = buf[0] % faces;
  }
  _lastPick.set(faces, pick);
  return pick;
}
