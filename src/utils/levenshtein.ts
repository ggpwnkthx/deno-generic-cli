/**
 * src/utils/levenshtein.ts
 *
 * Fast, memory-efficient Levenshtein distance implementation.  Used for fuzzy
 * command suggestions.
 */

/**
 * Returns the Levenshtein distance between two strings.
 * Uses O(min(a, b)) memory by keeping only previous & current rows.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  if (a.length > b.length) [a, b] = [b, a];

  const prev: number[] = Array.from({ length: a.length + 1 }, (_, i) => i);
  const curr: number[] = new Array(a.length + 1);

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    const bj = b.charCodeAt(j - 1);

    for (let i = 1; i <= a.length; i++) {
      const cost = a.charCodeAt(i - 1) === bj ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1, // insertion
        prev[i] + 1, // deletion
        prev[i - 1] + cost, // substitution
      );
    }
    // swap buffers
    for (let i = 0; i <= a.length; i++) prev[i] = curr[i];
  }
  return prev[a.length];
}
