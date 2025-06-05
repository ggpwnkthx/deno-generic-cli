/**
 * mod.ts
 *
 * Library entry-point.  Re-export the CLI class, error types, helpers, etc.
 */
export { CLI } from "./src/cli/mod.ts";
export {
  type CLIConfig,
  CLIError,
  type CommandOptions,
  type Middleware,
  type OutputMode,
} from "./src/types.ts";
export * from "./src/context.ts";
