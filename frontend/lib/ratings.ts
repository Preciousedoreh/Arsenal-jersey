/**
 * Mock helper: the share (%) of 5, 4, 3, 2 and 1-star ratings that averages to `rating`, using a
 * geometric fall-off. Replace with real review counts once reviews come from the API.
 */
export function ratingDistribution(rating: number): number[] {
  const target = Math.min(5, Math.max(3, rating));
  const weights = (q: number) => [5, 4, 3, 2, 1].map((stars) => q ** (5 - stars));
  const mean = (q: number) => {
    const w = weights(q);
    return w.reduce((sum, weight, i) => sum + weight * (5 - i), 0) / w.reduce((a, b) => a + b, 0);
  };

  // The mean falls from 5 (q = 0) towards 3 (q → 1), so bisect for the q that hits the target.
  let low = 0;
  let high = 0.999;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (mean(mid) > target) low = mid;
    else high = mid;
  }
  const w = weights((low + high) / 2);
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((weight) => Math.round((weight / total) * 100));
}
