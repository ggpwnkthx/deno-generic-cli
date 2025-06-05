/**
 * src/types.ts
 *
 * Shared type aliases, interfaces, and error classes for the generic‐cli framework.
 * Refactored for improved type safety (no `any` types).
 */

import type { ZodType } from "zod";
import type { CLIContext } from "./context.ts";

/** Raw flags/options before validation. */
export interface RawOptions extends Record<string, unknown> {
  /** Captures arguments after `--` */
  "--"?: string[];
}

/** Parsed CLI flags/options forwarded to user code. */
export type Options = RawOptions;

/** Shape of a generic CLI config loaded from file or env. */
export type CLIConfig = Record<string, unknown>;

/** Verbosity levels supported. */
export type Verbosity = "quiet" | "normal" | "verbose";

/** Output modes supported by `--output`. */
export type OutputMode = "text" | "json" | "yaml";

/**
 * A handler for an individual command, with typed flags.
 *
 * @param args - Positional arguments passed to the command.
 * @param flags - Typed, validated flags object.
 * @param ctx - CLIContext instance for logging, tracing, etc.
 */
export type CommandHandler<
  Flags extends Record<string, unknown> = Record<string, unknown>,
> = (
  args: string[],
  flags: Flags,
  ctx: CLIContext,
) => void | Promise<void>;

/** Lazy import metadata for deferred command loading. */
export interface LazyImport {
  /** Path or URL to import the module from. */
  path: string;
  /** Exported symbol name in the module (defaults to "default"). */
  symbol?: string;
}

/**
 * Command registration options.
 *
 * @template Flags - The shape of the expected flags for this command.
 */
export interface CommandOptions<
  Flags extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Human‐readable description (shown in `--help`). */
  description?: string;
  /** Example lines to show in help. */
  examples?: string[];
  /** Deprecated or alias names for this command. */
  aliases?: string[];
  /** If true, omit from normal help listing. */
  hidden?: boolean;
  /**
   * Zod schema for flags parsing; transforms raw options into typed Flags.
   *
   * The schema should accept `rawOptions: Record<string, unknown>` as input
   * and output an object matching `Flags`. No use of `any`.
   */
  flagsSchema?: ZodType<Flags, any, unknown>;
}

/**
 * Internal tree‐node representing a command, with metadata.
 *
 * @template Flags - The shape of the flags this node’s handler expects.
 */
export interface CommandNode<
  Flags extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * If set, contains the handler to invoke for this command.
   * Once a lazy import is resolved, `handler` will be populated and `lazyImport` cleared.
   */
  handler?: CommandHandler<Flags> | null;

  /**
   * If set, contains the module path and export symbol to import when this command is first invoked.
   * After the first invocation, `handler` will be assigned and `lazyImport` should be `undefined`.
   */
  lazyImport?: LazyImport;

  /** Registration options for this command node. */
  options: CommandOptions<Flags>;

  /**
   * Map of subcommand segment to child CommandNode.
   * Each child node may have its own Flags type.
   */
  children: Map<string, CommandNode>;
}

/** A hook that runs before or after each command invocation. */
export type Middleware = (ctx: CLIContext) => Promise<void> | void;

/**
 * Structured CLIError: handlers can throw this to indicate a controlled
 * failure, with a specific exitCode (defaults to 1).
 */
export class CLIError extends Error {
  readonly exitCode: number;

  constructor(msg: string, exitCode = 1) {
    super(msg);
    this.name = "CLIError";
    this.exitCode = exitCode;
  }
}
