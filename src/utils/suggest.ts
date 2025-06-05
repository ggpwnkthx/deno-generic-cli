/**
 * src/utils/suggest.ts
 *
 * Suggest the "closest" full command path given a mistyped input, based on
 * Levenshtein distance across the entire path.
 */

import type { CommandNode } from "../types.ts";
import { levenshtein } from "./levenshtein.ts";

/**
 * Given a command tree and a list of user-typed segments, return the best full
 * command path suggestion (e.g. "cluster node list") or null if no good match.
 */
export function suggestFullPath(
  root: CommandNode,
  targetParts: string[],
): string | null {
  const all: string[][] = [];
  function dfs(node: CommandNode, prefix: string[]): void {
    for (const [seg, child] of node.children) {
      const path = [...prefix, seg];
      if (child.handler || child.lazyImport) all.push(path);
      dfs(child, path);
    }
  }
  dfs(root, []);

  if (!all.length) return null;

  const want = targetParts.join(" ");
  let best: string[] | null = null;
  let bestNormalizedDistance = Infinity;

  for (const cand of all) {
    const candString = cand.join(" ");
    const rawDist = levenshtein(want, candString);
    const normalized = rawDist / Math.max(want.length, candString.length);
    if (normalized < bestNormalizedDistance) {
      bestNormalizedDistance = normalized;
      best = cand;
    }
  }
  // Only suggest if normalized distance < 0.3 (i.e. < 30% edits)
  return best && bestNormalizedDistance < 0.3 ? best.join(" ") : null;
}
