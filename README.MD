# Generic CLI Framework

A TypeScript-based, Deno v2 CLI framework that provides a structured way to
build command-line interfaces with support for command registration, lazy
loading, middleware hooks, automatic help generation, flag parsing, and more.

## Table of Contents

- [Features](#features)
- [Usage](#usage)
  - [Creating a CLI](#creating-a-cli)
  - [Registering Commands](#registering-commands)
  - [Lazy-Loaded Commands](#lazy-loaded-commands)
  - [Middleware Hooks](#middleware-hooks)
  - [Built-in Help & Error Handling](#built-in-help--error-handling)
  - [Configuration & Environment Overrides](#configuration--environment-overrides)
- [Examples](#examples)
  - [Basic Example](#basic-example)
  - [Lazy Command Example](#lazy-command-example)
  - [Middleware Example](#middleware-example)
  - [Nested Commands Example](#nested-commands-example)
- [API Reference](#api-reference)
  - [CLI Class](#cli-class)
    - [Constructor](#constructor)
    - [Methods](#methods)
  - [CommandRegistry](#commandregistry)
  - [CLIContext](#clicontext)
  - [Helpers & Utilities](#helpers--utilities)
- [Types](#types)
- [License](#license)

## Features

- **Command Registration**: Easily register commands and subcommands with typed
  flag schemas.
- **Lazy-Loaded Commands**: Load command modules only when invoked to reduce
  startup time.
- **Middleware Hooks**: Run code before and after every command.
- **Automatic Help Generation**: Built-in formatting and multi-column help
  output.
- **Configuration Loading**: YAML-based config file support with XDG
  conventions.
- **Environment Variable Overrides**: Override config values via environment
  variables.
- **Error Handling**: Structured `CLIError` class for controlled exits.
- **Spinner & Progress Indicators**: Visual feedback during long-running
  operations.

## Usage

### Creating a CLI

Create a new TypeScript file (e.g., `src/cli.ts`) and import the `CLI` class:

```ts
import { CLI } from "jsr:@ggpwnkthx/generic-cli";

async function main() {
  const cli = new CLI({ name: "my-cli", version: "1.0.0" });
  // Register commands, middleware, etc.
  await cli.run(Deno.args);
}

if (import.meta.main) {
  main();
}
```

### Registering Commands

Register commands using the `registerCommand` method:

```ts
import { z } from "zod";
import { CLI } from "jsr:@ggpwnkthx/generic-cli";

const flagsSchema = z.object({
  name: z.string().optional().default("World"),
});

const cli = new CLI({ name: "greeter", version: "1.0.0" });

cli.registerCommand(
  ["greet"],
  (_args, flags, ctx) => {
    const name = (flags as { name: string }).name;
    ctx.log(\`Hello, \${name}!\`);
  },
  {
    description: "Print a greeting",
    flagsSchema,
  },
);
```

- `path`: Array of command segments (e.g., `["user", "add"]`).
- `handler`: Function with signature
  `(args, flags, ctx) => void | Promise<void>`.
- `options`: Optional `CommandOptions` including `description`, `examples`,
  `aliases`, `hidden`, and `flagsSchema`.

### Lazy-Loaded Commands

Load command code only when invoked:

```ts
cli.registerLazyCommand(
  ["compute", "sum"],
  "./src/commands/sum.ts",
  "sumCommand",
  {
    description: "Compute the sum of numbers",
    examples: ["compute sum --numbers=1,2,3"],
  },
);
```

- `modPath`: Path to the module exporting the command handler.
- `symbol`: Exported symbol (defaults to `"default"`).

### Middleware Hooks

Run code before or after every command:

```ts
cli.beforeEach((ctx) => {
  console.log("Starting command...");
});

cli.afterEach((ctx) => {
  console.log("Command completed.");
});
```

### Built-in Help & Error Handling

- Automatic `--help` and `--version` support.
- Fuzzy matching and suggestions for unknown commands.
- Multi-column formatted help output generated from command tree.

```ts
// Internally, `printHelp` and `unknownCommand` handle help formatting.
```

### Configuration & Environment Overrides

Load a YAML config file and override values with environment variables:

```ts
import { loadConfigFile, loadEnvOverrides } from "../utils/mod.ts";

const fileConfig = await loadConfigFile("my-cli", parsed.config);
const envOverrides = loadEnvOverrides("my-cli");
```

- Config file search paths: `$XDG_CONFIG_HOME/<name>/config.yaml`,
  `~/.<name>/config.yaml`
- Env variables: `<NAME>_<KEY>=value`, automatically parsed into config keys.

## Examples

### Basic Example

```ts
import { z } from "zod";
import { CLI } from "jsr:@ggpwnkthx/generic-cli";

const greetFlagsSchema = z.object({
  name: z.string().optional().default("World"),
});

async function main() {
  const cli = new CLI({ name: "simple-greeter", version: "1.0.0" });

  cli.registerCommand(
    ["greet"],
    (_args, flags, ctx) => {
      const name = (flags as { name: string }).name;
      ctx.log(\`Hello, \${name}!\`);
    },
    {
      description: "Print a greeting",
      flagsSchema: greetFlagsSchema,
    },
  );

  await cli.run(Deno.args);
}

if (import.meta.main) {
  main();
}
```

### Lazy Command Example

```ts
import { CLI } from "jsr:@ggpwnkthx/generic-cli";

async function main() {
  const cli = new CLI({ name: "lazy-demo", version: "0.5.0" });

  cli.registerCommand(
    ["ping"],
    (_args, _flags, ctx) => {
      ctx.log("pong");
    },
    { description: "Ping–pong example" },
  );

  cli.registerLazyCommand(
    ["compute", "sum"],
    "./src/commands/sum.ts",
    "sumCommand",
    {
      description: "Compute the sum of a list of numbers",
      examples: ["compute sum --numbers=1,2,3,4"],
    },
  );

  await cli.run(Deno.args);
}

if (import.meta.main) {
  main();
}
```

### Middleware Example

```ts
import { CLI } from "jsr:@ggpwnkthx/generic-cli";

async function main() {
  const cli = new CLI({ name: "timed-cli", version: "1.0.0" });

  cli.beforeEach((ctx) => {
    const timestamp = new Date().toISOString();
    console.log(\`[\${timestamp}] Starting command\`);
  });

  cli.afterEach((ctx) => {
    console.log(\`[\${new Date().toISOString()}] Command completed\`);
  });

  cli.registerCommand(
    ["echo"],
    (args, flags, ctx) => {
      ctx.log(args.join(" "));
    },
    { description: "Echo back positional arguments" },
  );

  cli.registerCommand(
    ["wait"],
    async (_args, flags, ctx) => {
      const ms = Number(flags["milliseconds"] ?? 1000);
      ctx.startSpinner(\`Waiting for \${ms}ms…\`);
      await new Promise((resolve) => setTimeout(resolve, ms));
      ctx.stopSpinner();
      ctx.log(\`Waited \${ms}ms\`);
    },
    {
      description: "Wait for a specified number of milliseconds",
    },
  );

  await cli.run(Deno.args);
}

if (import.meta.main) {
  main();
}
```

### Nested Commands Example

```ts
import { z } from "zod";
import { CLI, CLIError } from "jsr:@ggpwnkthx/generic-cli";

const addUserFlagsSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  admin: z.boolean().optional().default(false),
});

const removeUserFlagsSchema = z.object({
  username: z.string().min(1),
  force: z.boolean().optional().default(false),
});

async function main() {
  const cli = new CLI({ name: "user-manager", version: "2.0.0" });

  cli.registerCommand(
    ["user", "add"],
    (_args, flags, ctx) => {
      const { username, email, admin } = flags as {
        username: string;
        email: string;
        admin: boolean;
      };
      if (username === "existingUser") {
        throw new CLIError(\`User "\${username}" already exists.\`, 2);
      }
      ctx.log(\`Adding user: \${username} (\${email})\${admin ? " [admin]" : ""}\`);
    },
    {
      description: "Add a new user to the system",
      aliases: ["create"],
      flagsSchema: addUserFlagsSchema,
    },
  );

  cli.registerCommand(
    ["user", "remove"],
    (_args, flags, ctx) => {
      const { username, force } = flags as { username: string; force: boolean };
      if (!force) {
        ctx.warn(\`Removing user "\${username}" without --force. Proceed carefully!\`);
      }
      ctx.log(\`Removed user: \${username}\`);
    },
    {
      description: "Remove an existing user",
      aliases: ["rm"],
      flagsSchema: removeUserFlagsSchema,
    },
  );

  await cli.run(Deno.args);
}

if (import.meta.main) {
  main();
}
```

## API Reference

### CLI Class

#### Constructor

```ts
constructor(info?: { name?: string; version?: string });
```

- `info.name`: Optional CLI name (defaults to `"generic-cli"`)
- `info.version`: Optional version (defaults to `"0.0.0"`)
- Automatically attempts to load name and version from `deno.json` or
  `deno.jsonc` if defaults are used.

#### Methods

- `registerCommand(path, handler, options?)`: Register a new command.
- `registerLazyCommand(path, modPath, symbol?, options?)`: Register a
  lazy-loaded command.
- `beforeEach(fn)`: Add a hook to run before every command.
- `afterEach(fn)`: Add a hook to run after every command.
- `run(argv)`: Execute the CLI with raw `argv` (`Deno.args`).

### CommandRegistry

Manages the command tree, supports:

- `registerCommand(path, handler, options?)`
- `registerLazyCommand(path, modPath, symbol?, options?)`
- `traverse(path)`: Find the deepest matching node and number of segments
  consumed.

### CLIContext

Context passed to command handlers:

- `args`: Positional arguments after the command path.
- `options`: Parsed flags/options.
- `log(msg)`, `warn(msg)`, `error(msg)`, `debug(msg)`: Logging utilities.
- `startSpinner(msg)`, `stopSpinner()`: Progress spinner.
- `progress(current, total, desc?)`: Progress bar.
- `startSpan(name)`, `endSpan()`, `ok()`, `fail(err)`: Tracing helpers.
- `signal`: AbortSignal tied to Ctrl-C.
- `onAbort(fn)`: Register abort handler.
- `fatal(msg, code?)`: Exit with error.
- `handleError(err)`: Structured error handling.

### Helpers & Utilities

- `printHelp(cliName, root, verbosity)`: Print formatted help text.
- `unknownCommand(cmd, root, verbosity)`: Handle unknown commands with
  suggestions.
- Config & environment helpers in `src/utils/`:
  - `loadConfigFile(name, explicitPath?)`
  - `loadEnvOverrides(prefix)`

## Types

- `CommandHandler<Flags>`:
  `(args: string[], flags: Flags, ctx: CLIContext) => void | Promise<void>`
- `CommandOptions<Flags>`:
  `{ description?: string; examples?: string[]; aliases?: string[]; hidden?: boolean; flagsSchema?: ZodType<Flags> }`
- `CLIConfig`: `Record<string, unknown>`
- `Options`: `RawOptions` after parsing.
- `Verbosity`: `"quiet" | "normal" | "verbose"`
- `OutputMode`: `"text" | "json" | "yaml"`
