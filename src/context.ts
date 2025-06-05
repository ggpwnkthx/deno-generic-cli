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
  start(): void {
    if (this.#intervalId !== null) return;
    this.#intervalId = setInterval(() => {
      Deno.stdout.write(
        new TextEncoder().encode(`\r${this.currentFrame()} ${this.message}`),
      );
      this.#index = (this.#index + 1) % this.#frames.length;
    }, 80);
  }
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

export class CLIContext {
  readonly tracer: Tracer = trace.getTracer("generic-cli");
  #span: Span | null = null;
  #verbosity: Verbosity;
  #outputMode: OutputMode;
  #dataStore = new Map<string, unknown>();
  #spinner: Spinner | null = null;
  #signalController = new AbortController();

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

  startSpan(name: string): void {
    this.#span = this.tracer.startSpan(name);
  }

  endSpan(): void {
    this.#span?.end();
  }

  ok(): void {
    this.#span?.setStatus({ code: SpanStatusCode.OK });
  }

  fail(err: unknown): void {
    this.#span?.setStatus({
      code: SpanStatusCode.ERROR,
      message: String(err),
    });
  }

  // -------------------- Context store (hierarchical) --------------------

  /** Store an arbitrary key/value in this context (for middleware/plugins). */
  set(key: string, val: unknown): void {
    this.#dataStore.set(key, val);
  }

  /** Retrieve a value previously stored. */
  get<T>(key: string): T | undefined {
    return this.#dataStore.get(key) as T | undefined;
  }

  // -------------------- Progress / Spinner --------------------

  /** Start a spinner with a given message. Call `.stopSpinner()` to end. */
  startSpinner(msg: string): void {
    if (this.#verbosity === "quiet") return;
    this.#spinner = new Spinner(msg);
    this.#spinner.start();
  }

  /** Stop the current spinner. */
  stopSpinner(): void {
    this.#spinner?.stop();
    this.#spinner = null;
  }

  /**
   * Print a progress line “[current/total] …desc…”.
   * If in quiet mode, this is no-op.
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

  /** Returns the AbortSignal tied to Ctrl‐C (SIGINT). */
  get signal(): AbortSignal {
    return this.#signalController.signal;
  }

  /** Register a handler to run if the user hits Ctrl‐C. */
  onAbort(fn: () => void): void {
    this.signal.addEventListener("abort", () => fn());
  }

  // -------------------- Logging helpers --------------------

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

  error(msg: string | Record<string, unknown>): void {
    // Always show errors, even in quiet mode
    if (this.#outputMode === "json") {
      console.log(JSON.stringify(msg));
    } else if (this.#outputMode === "yaml") {
      console.log(stringifyYAML(msg));
    } else {
      console.log(red(String(msg)));
    }
  }

  // -------------------- Exit helpers --------------------

  /** Immediately exit with given code, printing msg in red. */
  fatal(msg: string, code = 1): never {
    this.error(msg);
    Deno.exit(code);
  }

  // -------------------- Structured errors --------------------

  /** If err is a CLIError, exits with its exitCode; else with 1. */
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
