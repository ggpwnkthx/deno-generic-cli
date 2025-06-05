/**
 * src/context.ts
 *
 * Provides a helper class that is passed to every command handler, offering
 * convenience logging helpers, OTEL tracing, flag access, interactive prompts,
 * progress indicators, and abort‐signal wiring.
 */

import { blue, green, red, yellow } from "@std/fmt/colors";
import { type Span, SpanStatusCode, type Tracer } from "@opentelemetry/api";
import { trace } from "@opentelemetry/api";
import type { Options, OutputMode, Verbosity } from "./types.ts";
import { CLIError } from "./types.ts";
import { stringify as stringifyYAML } from "@std/yaml";

/**
 * Mapping of verbosity levels to numeric weights.
 * Used internally to determine whether to emit log/progress output.
 */
export const LEVEL_WEIGHT: Record<Verbosity, number> = {
  quiet: 0,
  normal: 1,
  verbose: 2,
};

/** A simple spinner for progress indication. */
class Spinner {
  #frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  #intervalId: number | null = null;
  #index = 0;

  constructor(private readonly message: string) {}

  /**
   * Start the spinner. Subsequent calls have no effect if spinner is already running.
   */
  start(): void {
    if (this.#intervalId !== null) return;
    this.#intervalId = setInterval(() => {
      Deno.stdout.write(
        new TextEncoder().encode(`\r${this.currentFrame()} ${this.message}`),
      );
      this.#index = (this.#index + 1) % this.#frames.length;
    }, 80);
  }

  /**
   * Stop the spinner and clear the line.
   */
  stop(): void {
    if (this.#intervalId !== null) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
      Deno.stdout.write(
        new TextEncoder().encode(`\r${" ".repeat(this.message.length + 2)}\r`),
      );
    }
  }

  private currentFrame(): string {
    return this.#frames[this.#index];
  }
}

/**
 * Context passed into every command handler, offering utilities such as:
 * - `args`: positional arguments after the command path
 * - `options`: parsed flags/options
 * - Logging methods (log, warn, error, debug)
 * - Spinner and progress helpers
 * - Tracing (startSpan, endSpan, ok, fail)
 * - Abort signal handling for Ctrl-C
 * - Structured error handling
 */
export class CLIContext {
  readonly tracer: Tracer = trace.getTracer("generic-cli");
  #span: Span | null = null;
  #verbosity: Verbosity;
  #outputMode: OutputMode;
  #dataStore = new Map<string, unknown>();
  #spinner: Spinner | null = null;
  #signalController = new AbortController();

  /**
   * Create a new CLIContext.
   *
   * @param args - Remaining positional arguments after the command path.
   * @param options - Parsed flags/options object.
   * @param verbosity - Verbosity level ("quiet", "normal", or "verbose").
   * @param outputMode - Output mode ("text", "json", or "yaml").
   */
  constructor(
    public readonly args: string[],
    public readonly options: Options,
    verbosity: Verbosity = "normal",
    outputMode: OutputMode = "text",
  ) {
    this.#verbosity = verbosity;
    this.#outputMode = outputMode;
  }

  // -------------------- Tracing helpers --------------------

  /**
   * Start a new tracing span with the given name.
   *
   * @param name - Name of the span.
   */
  startSpan(name: string): void {
    this.#span = this.tracer.startSpan(name);
  }

  /**
   * End the current tracing span, if any.
   */
  endSpan(): void {
    this.#span?.end();
  }

  /**
   * Mark the current span status as OK.
   */
  ok(): void {
    this.#span?.setStatus({ code: SpanStatusCode.OK });
  }

  /**
   * Mark the current span status as ERROR with a message.
   *
   * @param err - The error that occurred.
   */
  fail(err: unknown): void {
    this.#span?.setStatus({
      code: SpanStatusCode.ERROR,
      message: String(err),
    });
  }

  // -------------------- Context store (hierarchical) --------------------

  /**
   * Store an arbitrary key/value in this context (for middleware/plugins).
   *
   * @param key - Key name.
   * @param val - Value to store.
   */
  set(key: string, val: unknown): void {
    this.#dataStore.set(key, val);
  }

  /**
   * Retrieve a value previously stored in this context.
   *
   * @typeParam T - Expected type of the stored value.
   * @param key - Key name.
   * @returns The stored value, or `undefined` if not present.
   */
  get<T>(key: string): T | undefined {
    return this.#dataStore.get(key) as T | undefined;
  }

  // -------------------- Progress / Spinner --------------------

  /**
   * Start a spinner with a given message. Call `.stopSpinner()` to end.
   * No-op if verbosity is "quiet".
   *
   * @param msg - The message to display alongside the spinner.
   */
  startSpinner(msg: string): void {
    if (this.#verbosity === "quiet") return;
    this.#spinner = new Spinner(msg);
    this.#spinner.start();
  }

  /**
   * Stop the current spinner, if any.
   */
  stopSpinner(): void {
    this.#spinner?.stop();
    this.#spinner = null;
  }

  /**
   * Print a progress line “[current/total] …desc…”.
   * If in quiet mode, this is a no-op.
   *
   * @param current - Current progress count.
   * @param total - Total count.
   * @param desc - Optional description to display.
   */
  progress(current: number, total: number, desc?: string): void {
    if (this.#verbosity === "quiet") return;
    const barSize = 20;
    const ratio = total > 0 ? current / total : 1;
    const filled = Math.floor(ratio * barSize);
    const empty = barSize - filled;
    const bar = `[${"#".repeat(filled)}${"-".repeat(empty)}]`;
    Deno.stdout.write(
      new TextEncoder().encode(
        `\r${bar} ${current}/${total} ${desc ?? ""}`,
      ),
    );
    if (current >= total) {
      Deno.stdout.write(new TextEncoder().encode("\n"));
    }
  }

  // -------------------- Abort / Signal handling --------------------

  /**
   * Return the AbortSignal tied to Ctrl‐C (SIGINT).
   *
   * @returns The AbortSignal for this context.
   */
  get signal(): AbortSignal {
    return this.#signalController.signal;
  }

  /**
   * Register a handler to run if the user hits Ctrl‐C.
   *
   * @param fn - Function to call upon abort.
   */
  onAbort(fn: () => void): void {
    this.signal.addEventListener("abort", () => fn());
  }

  // -------------------- Logging helpers --------------------

  /**
   * Log a message or object. No-op if verbosity is "quiet".
   *
   * @param msg - The message string or object to log.
   */
  log(msg: string | Record<string, unknown>): void {
    if (this.#verbosity === "quiet") return;
    if (this.#outputMode === "json") {
      console.log(JSON.stringify(msg));
    } else if (this.#outputMode === "yaml") {
      console.log(stringifyYAML(msg));
    } else {
      console.log(green(String(msg)));
    }
  }

  /**
   * Log a warning message or object. No-op if verbosity is "quiet".
   *
   * @param msg - The warning message string or object to log.
   */
  warn(msg: string | Record<string, unknown>): void {
    if (this.#verbosity === "quiet") return;
    if (this.#outputMode === "json") {
      console.log(JSON.stringify(msg));
    } else if (this.#outputMode === "yaml") {
      console.log(stringifyYAML(msg));
    } else {
      console.log(yellow(String(msg)));
    }
  }

  /**
   * Log a debug message or object. Only emits if verbosity is "verbose".
   *
   * @param msg - The debug message string or object to log.
   */
  debug(msg: string | Record<string, unknown>): void {
    if (this.#verbosity === "quiet") return;
    if (this.#verbosity === "verbose") {
      if (this.#outputMode === "json") {
        console.log(JSON.stringify(msg));
      } else if (this.#outputMode === "yaml") {
        console.log(stringifyYAML(msg));
      } else {
        console.log(blue(String(msg)));
      }
    }
  }

  /**
   * Log an error message or object. Always shown, even in quiet mode.
   *
   * @param msg - The error message string or object to log.
   */
  error(msg: string | Record<string, unknown>): void {
    if (this.#outputMode === "json") {
      console.log(JSON.stringify(msg));
    } else if (this.#outputMode === "yaml") {
      console.log(stringifyYAML(msg));
    } else {
      console.log(red(String(msg)));
    }
  }

  // -------------------- Exit helpers --------------------

  /**
   * Immediately exit with a given code, printing the message in red.
   *
   * @param msg - The message to display before exiting.
   * @param code - Exit code (default: 1).
   * @returns Never returns (exits the process).
   */
  fatal(msg: string, code = 1): never {
    this.error(msg);
    Deno.exit(code);
  }

  // -------------------- Structured errors --------------------

  /**
   * If `err` is a CLIError, exits with its exitCode and prints its message.
   * Otherwise, prints the stringified error and exits with code 1.
   *
   * @param err - The error to handle.
   */
  handleError(err: unknown): void {
    if (err instanceof CLIError) {
      this.error(err.message);
      Deno.exit(err.exitCode);
    } else {
      this.error(String(err));
      Deno.exit(1);
    }
  }
}
