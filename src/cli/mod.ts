/**
 * src/cli/mod.ts
 *
 * This is now the public entrypoint containing the `CLI` class. Internals
 * have been pushed into `registry.ts`, `helpers.ts`, and `packageInfo.ts`.
 */

import { parseArgs } from "@std/cli";
import type { ZodType } from "zod";
import { type CLIConfig, CLIError, type CommandHandler } from "../types.ts";
import { CLIContext } from "../context.ts";
import { loadConfigFile, loadEnvOverrides } from "../utils/mod.ts";
import { CommandRegistry } from "./registry.ts";
import { loadPackageInfo } from "./packageInfo.ts";
import { printHelp, unknownCommand } from "./helpers.ts";

type Middleware = (ctx: CLIContext) => Promise<void> | void;

export class CLI {
  #registry = new CommandRegistry();
  #name: string;
  #version: string;
  #beforeMiddleware: Middleware[] = [];
  #afterMiddleware: Middleware[] = [];
  #config: CLIConfig = {};

  constructor(info: { name?: string; version?: string } = {}) {
    this.#name = info.name ?? "generic-cli";
    this.#version = info.version ?? "0.0.0";

    // Fire-and-forget: attempt to auto-load name/version from deno.json / deno.jsonc
    this.#initializePackageInfo().catch(() => {});
  }

  // -------------------- Public API --------------------

  /**
   * Register a new (non-lazy) command.
   */
  registerCommand<Path extends readonly string[]>(
    path: Path,
    handler: CommandHandler,
    options: Parameters<CommandRegistry["registerCommand"]>[2] = {},
  ): void {
    this.#registry.registerCommand(path, handler, options);
  }

  /**
   * Register a lazy-loaded command (module imported only when invoked).
   */
  registerLazyCommand(
    path: string[],
    modPath: string,
    symbol = "default",
    options: Parameters<CommandRegistry["registerLazyCommand"]>[3] = {},
  ): void {
    this.#registry.registerLazyCommand(path, modPath, symbol, options);
  }

  /**
   * Add a before-each hook (runs before every command).
   */
  beforeEach(fn: Middleware): void {
    this.#beforeMiddleware.push(fn);
  }

  /**
   * Add an after-each hook (runs after every command).
   */
  afterEach(fn: Middleware): void {
    this.#afterMiddleware.push(fn);
  }

  /**
   * Execute the CLI with raw argv (e.g. `Deno.args`).
   */
  async run(argv: string[]): Promise<void> {
    // 1. Parse global flags
    const parsed = parseArgs(argv, {
      boolean: ["help", "version", "quiet", "verbose"],
      string: ["color", "output", "config", "otel-endpoint"],
      alias: {
        h: "help",
        V: "version",
        q: "quiet",
        v: "verbose",
      },
      stopEarly: true,
      "--": true,
    });

    // Determine output mode (text | json | yaml)
    const outputMode = (parsed.output === "json" || parsed.output === "yaml")
      ? (parsed.output as "json" | "yaml")
      : "text";

    // 2. Load config file (YAML) + ENV overrides
    const configPath = parsed.config as string | undefined;
    const fileConfig = await loadConfigFile(this.#name, configPath);
    const envOverrides = loadEnvOverrides(this.#name);
    // Merge precedence: CLI flags > ENV > config file
    this.#config = { ...fileConfig, ...envOverrides };

    // 3. Handle `--version`
    if (parsed.version) {
      console.log(`${this.#name} ${this.#version}`);
      return;
    }

    // 4. Determine verbosity
    const verbosity = parsed.quiet
      ? "quiet"
      : parsed.verbose
      ? "verbose"
      : "normal";

    // 5. Extract positional segments (everything after flags)
    const positionals = parsed._.map(String);
    if (parsed.help || positionals.length === 0) {
      // Print top-level help
      printHelp(this.#name, this.#registry.root, verbosity);
      return;
    }

    // 6. Traverse the command tree
    const { node, consumed } = this.#registry.traverse(positionals);
    if (!node?.handler && !node?.lazyImport) {
      // Unknown command: show error + suggestion + full help
      const unknownCmdName = positionals.slice(0, consumed + 1).join(" ");
      unknownCommand(unknownCmdName, this.#registry.root, verbosity);
      return;
    }

    // 7. Prepare context for command-specific execution
    //    - remainingArgs: positional args after the command path
    //    - rawFlags: any raw values from parsed global flags and config
    const remainingArgs = positionals.slice(consumed);
    // Combine file/config defaults, env overrides, and any new parsed global flags
    // Note: we keep these in a rawFlags object to feed into Zod if a flagsSchema exists
    const rawFlags: Record<string, unknown> = {
      ...this.#config,
      ...(parsed as Record<string, unknown>),
    };
    if (parsed["--"]) {
      rawFlags["--"] = parsed["--"];
    }

    // 8. Run `beforeEach` middleware
    const ctx = new CLIContext(remainingArgs, rawFlags, verbosity, outputMode);
    for (const mw of this.#beforeMiddleware) {
      await mw(ctx);
    }

    // 9. Resolve the handler (import if lazy)
    let handler: CommandHandler;
    const options = node.options;
    if (node.handler) {
      handler = node.handler;
    } else {
      // Lazy load
      const { path: modPath, symbol } = node.lazyImport!;
      const imported = await import(modPath);
      handler = symbol && imported[symbol]
        ? (imported[symbol] as CommandHandler)
        : (imported.default as CommandHandler);
      if (typeof handler !== "function") {
        throw new Error(`Lazy import did not yield a function (${modPath})`);
      }
      // Cache it so next time we don't re-import
      node.handler = handler;
      node.lazyImport = undefined;
    }

    // 10. Parse and validate flags using flagsSchema (if provided)
    //     - We use Zod to validate the merged rawFlags object.
    //     - If validation fails, print errors and exit.
    let validatedFlags: Record<string, unknown> = {};
    if (options.flagsSchema) {
      try {
        // Cast to ZodType for proper parsing
        const schema = options.flagsSchema as ZodType<Record<string, unknown>>;
        const result = schema.safeParse(rawFlags);
        if (!result.success) {
          // ZodError: print formatted errors
          const zodErr = result.error;
          ctx.error(`\nInvalid flags:\n${zodErr.format()}`);
          Deno.exit(1);
        }
        validatedFlags = result.data;
      } catch (err) {
        ctx.error(`Error parsing flags: ${String(err)}`);
        Deno.exit(1);
      }
    } else {
      // No schema: pass through all raw flags (including globals)
      validatedFlags = rawFlags;
    }

    // 11. Start the span/tracing
    const spanName = positionals.slice(0, consumed).join(" ") || "root";
    ctx.startSpan(spanName);

    // 12. Execute the handler
    try {
      await handler(ctx.args, validatedFlags, ctx);
      ctx.ok();
    } catch (err) {
      ctx.fail(err);
      if (err instanceof CLIError) {
        ctx.error(err.message);
        Deno.exit(err.exitCode);
      } else {
        ctx.error(String(err));
        Deno.exit(1);
      }
    } finally {
      ctx.endSpan();
    }

    // 13. Run `afterEach` middleware
    for (const mw of this.#afterMiddleware) {
      await mw(ctx);
    }
  }

  // -------------------- Private Helpers --------------------

  /**
   * Fire-and-forget: attempt to auto-load name/version from deno.json / deno.jsonc
   * if the user didn't explicitly pass them into `new CLI({ name, version })`.
   */
  async #initializePackageInfo(): Promise<void> {
    const loaded = await loadPackageInfo(this.#name, this.#version);
    if (loaded.name) {
      this.#name = loaded.name;
    }
    if (loaded.version) {
      this.#version = loaded.version;
    }
  }
}
