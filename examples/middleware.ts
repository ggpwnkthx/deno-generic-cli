import { CLI } from "@ggpwnkthx/generic-cli";

async function main() {
  const cli = new CLI({ name: "timed-cli", version: "1.0.0" });

  // beforeEach: print a timestamp and the exact command invoked
  cli.beforeEach((_ctx) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Starting command`);
  });

  // afterEach: measure elapsed time and print it
  cli.afterEach((_ctx) => {
    // The CLIContext provides a tracer span, but here we'll simply log a static message.
    console.log(`[${new Date().toISOString()}] Command completed`);
  });

  // A simple “echo” command
  cli.registerCommand(
    ["echo"],
    (args, _flags, ctx) => {
      // echo just prints all positional args joined by spaces
      ctx.log(args.join(" "));
    },
    { description: "Echo back positional arguments" },
  );

  // A longer-running “wait” command to demonstrate the spinner
  cli.registerCommand(
    ["wait"],
    async (_args, flags, ctx) => {
      const ms = Number(flags["milliseconds"] ?? 1000);
      ctx.startSpinner(`Waiting for ${ms}ms…`);
      await new Promise((resolve) => setTimeout(resolve, ms));
      ctx.stopSpinner();
      ctx.log(`Waited ${ms}ms`);
    },
    {
      description: "Wait for a specified number of milliseconds",
      flagsSchema: undefined, // no schema, so flags pass through raw
    },
  );

  await cli.run(Deno.args);
}

if (import.meta.main) {
  main();
}
