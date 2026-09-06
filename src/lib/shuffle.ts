// Plain utility, no "use client" — used both client-side (useShuffle, for
// the manual Shuffle buttons) and server-side (promptRecommender, for
// randomizing which candidates get shown) so the algorithm can't drift
// between the two.
export function fisherYatesShuffle<T>(list: T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
