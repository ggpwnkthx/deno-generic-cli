// src/utils/help.ts

import { bold } from "@std/fmt/colors";
import type { CommandNode } from "../types.ts";

/* ------------------------------------------------------------------ *
 *  Help formatter (with grouping by first segment)
 * ------------------------------------------------------------------ */

interface Row {
  path: string;
  desc: string;
  group: string; // first segment
}

export function formatHelpLines(
  cliName: string,
  root: CommandNode,
): string[] {
  const lines: string[] = [];
  lines.push(`${bold("Usage:")} ${cliName} <command> [...args] [options]`);
  lines.push("");

  // Build rows
  const rows: Row[] = [];
  function dfs(node: CommandNode, prefix: string[]): void {
    const sorted = [...node.children.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [seg, child] of sorted) {
      if (child.options.hidden) continue;
      const path = [...prefix, seg].join(" ");
      const desc = child.options.description ??
        (prefix.length ? node.options.description ?? "" : "");
      const group = prefix.length === 0 ? seg : prefix[0];
      rows.push({ path, desc, group });
      dfs(child, [...prefix, seg]);
    }
  }
  dfs(root, []);

  // Group rows by first segment
  const groups: Record<string, Row[]> = {};
  for (const row of rows) {
    const first = row.group;
    if (!groups[first]) groups[first] = [];
    groups[first].push(row);
  }

  lines.push(`${bold("Commands:")}`);
  lines.push("");
  // For each group, print header and entries
  const groupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  for (const group of groupNames) {
    const groupRows = groups[group];
    // Find padding width only for this group
    const pad = groupRows.reduce((m, r) => Math.max(m, r.path.length), 0) + 2;
    for (const { path, desc } of groupRows) {
      const spacing = " ".repeat(pad - path.length);
      lines.push(`  ${path}${spacing}${desc ? `– ${desc}` : ""}`);
    }
    lines.push(""); // blank line after each group
  }

  lines.push(`${bold("Options:")}`);
  lines.push("  -h, --help            Show help");
  lines.push("  -V, --version         Show version");
  lines.push("  -q, --quiet           Suppress all output except errors");
  lines.push("  -v, --verbose         Chatty output; includes debug logs");
  lines.push(
    "  --color=[auto|always|never]   Color mode (default: auto)",
  );
  lines.push(
    "  --output=[text|json|yaml]     Output mode (default: text)",
  );
  lines.push("  --config=<path>       Path to config file");
  lines.push("  --otel-endpoint=<url> OpenTelemetry collector endpoint");
  lines.push("");
  lines.push(
    `Run "${cliName} completion [bash|zsh|fish]" to generate shell completions`,
  );
  lines.push("");
  lines.push(
    `${bold("Global Options Precedence:")} CLI flags > ENV > config file`,
  );
  return lines;
}
