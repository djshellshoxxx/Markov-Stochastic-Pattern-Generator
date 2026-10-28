export function euclidean(
  steps: number,
  pulses: number,
  rotation = 0,
): boolean[] {
  const n = Math.max(2, Math.min(32, Math.round(steps)));
  const k = Math.max(0, Math.min(n, Math.round(pulses)));
  const r = ((Math.round(rotation) % n) + n) % n;
  return Array.from({ length: n }, (_, i) => (((i - r + n) % n) * k) % n < k);
}
