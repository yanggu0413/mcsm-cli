export function clampPageSize(val: any, defaultSize: number = 20, max: number = 50): number {
  const n = Number(val);
  if (isNaN(n) || n < 1) return defaultSize;
  return Math.min(n, max);
}
