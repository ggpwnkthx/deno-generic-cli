// src/cli/helpers.ts

import { cyan, red } from "@std/fmt/colors";
import { formatHelpLines, suggestFullPath } from "../utils/mod.ts";
import type { CommandNode } from "../types.ts";

type Verbosity = "quiet" | "normal" | "verbose";

/**
 * Print help text (multi-column) according to verbosity.
 * If verbosity is "quiet", do nothing.
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
 * Called when an unknown command is invoked: prints an error + suggestion + full help.
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
