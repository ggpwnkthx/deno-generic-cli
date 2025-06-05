// src/cli/helpers.ts

import { cyan, red } from "@std/fmt/colors";
import { formatHelpLines, suggestFullPath } from "../utils/mod.ts";
import type { CommandNode } from "../types.ts";

type Verbosity = "quiet" | "normal" | "verbose";

/**
 * Print help text (multi-column) according to verbosity.
 * If verbosity is "quiet", this function does nothing.
 *
 * @param cliName - The name of the CLI, used in the usage line.
 * @param root - The root CommandNode of the command tree.
 * @param verbosity - The verbosity level ("quiet", "normal", or "verbose").
 */
export function printHelp(
  cliName: string,
  root: CommandNode,
  verbosity: Verbosity,
): void {
  if (verbosity === "quiet") return;
  const lines = formatHelpLines(cliName, root);
  for (const l of lines) {
    console.log(l);
  }
}

/**
 * Called when an unknown command is invoked: prints an error, possibly a suggestion,
 * and then the full help.
 *
 * @param cmd - The unknown command string that was invoked.
 * @param root - The root CommandNode of the command tree.
 * @param verbosity - The current verbosity level ("quiet", "normal", or "verbose").
 */
export function unknownCommand(
  cmd: string,
  root: CommandNode,
  verbosity: Verbosity,
): void {
  if (verbosity !== "quiet") {
    console.error(red(`\nUnknown command: ${cmd}\n`));
    // Attempt a suggestion
    const parts = cmd.split(" ");
    const closest = suggestFullPath(root, parts);
    if (closest) {
      console.error(`Did you mean ${cyan(closest)} ?\n`);
    }
  }
  // Always print full help (unless quiet)
  printHelp("", root, verbosity);
}
