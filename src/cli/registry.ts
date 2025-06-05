// src/cli/registry.ts

/**
 * src/cli/registry.ts
 *
 * All logic around registering commands, building the command tree,
 * and traversing it at runtime.
 */

import type { CommandHandler, CommandNode, CommandOptions } from "../types.ts";

/**
 * Manages the command tree, supports registering commands (and aliases),
 * lazy-loading commands, and traversing the tree based on path segments.
 */
export class CommandRegistry {
  /** Root of the command tree. */
  public root: CommandNode = { children: new Map(), options: {} };

  /**
   * Register a new (non-lazy) command with typed flags.
   *
   * @typeParam Path - Array of command segments (e.g., ["cluster", "node", "add"]).
   * @typeParam Flags - Type of flags for this command.
   * @param path - Array of segments defining the command path.
   * @param handler - Function to run when the command is invoked.
   * @param options - Metadata including description, examples, aliases, hidden, flagsSchema.
   * @throws Error if `path` is empty or the command is already registered.
   */
  registerCommand<
    Path extends readonly string[],
    Flags extends Record<string, unknown>,
  >(
    path: Path,
    handler: CommandHandler<Flags>,
    options: CommandOptions<Flags> = {},
  ): void {
    if (path.length === 0) {
      throw new Error("registerCommand() requires at least one path segment");
    }
    let node = this.root;
    for (const seg of path) {
      if (!node.children.has(seg)) {
        node.children.set(seg, { children: new Map(), options: {} });
      }
      node = node.children.get(seg)!;
    }
    if (node.handler || node.lazyImport) {
      throw new Error(`Command already registered: ${path.join(" ")}`);
    }
    node.handler = handler as CommandHandler;
    node.options = options as CommandOptions;

    // register aliases (if any) as hidden commands at the same parent level
    if (options.aliases) {
      for (const alias of options.aliases) {
        let parent = this.root;
        for (let i = 0; i < path.length - 1; i++) {
          parent = parent.children.get(path[i])!;
        }
        parent.children.set(alias, {
          children: new Map(),
          handler: handler as CommandHandler,
          options: { ...options, hidden: true } as CommandOptions,
        });
      }
    }
  }

  /**
   * Register a lazy-loaded command. The actual module is imported only when invoked.
   *
   * @param path - Array of segments defining the command path.
   * @param modPath - File path or URL to import the module from.
   * @param symbol - Exported handler symbol name in the module (defaults to "default").
   * @param options - Metadata including description, examples, aliases, hidden, flagsSchema.
   * @throws Error if `path` is empty or the command is already registered.
   */
  registerLazyCommand(
    path: string[],
    modPath: string,
    symbol = "default",
    options: CommandOptions = {},
  ): void {
    if (path.length === 0) {
      throw new Error(
        "registerLazyCommand() requires at least one path segment",
      );
    }
    let node = this.root;
    for (const seg of path) {
      if (!node.children.has(seg)) {
        node.children.set(seg, { children: new Map(), options: {} });
      }
      node = node.children.get(seg)!;
    }
    if (node.handler || node.lazyImport) {
      throw new Error(`Command already registered: ${path.join(" ")}`);
    }
    node.lazyImport = { path: modPath, symbol };
    node.options = options;

    // register aliases (if any) as hidden lazy imports
    if (options.aliases) {
      for (const alias of options.aliases) {
        let parent = this.root;
        for (let i = 0; i < path.length - 1; i++) {
          parent = parent.children.get(path[i])!;
        }
        parent.children.set(alias, {
          children: new Map(),
          lazyImport: { path: modPath, symbol },
          options: { ...options, hidden: true },
        });
      }
    }
  }

  /**
   * Traverse the command tree according to `path` segments.
   * Returns the deepest node found (or `null`) and how many segments were consumed.
   *
   * Example:
   *   path = ["cluster", "node", "add", "foo"]
   *   returns node for "add" and consumed = 3
   *
   * @param path - Array of path segments (strings).
   * @returns An object `{ node, consumed }` where `node` is the deepest matching CommandNode (or null),
   *          and `consumed` is the number of segments matched.
   */
  traverse(path: string[]): { node: CommandNode | null; consumed: number } {
    let node: CommandNode | null = this.root;
    let idx = 0;
    while (idx < path.length && node?.children.has(path[idx])) {
      node = node.children.get(path[idx])!;
      idx++;
    }
    return { node, consumed: idx };
  }
}
