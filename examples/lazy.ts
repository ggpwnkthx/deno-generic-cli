import { CLI } from "@ggpwnkthx/generic-cli";

async function main() {
  const cli = new CLI({ name: "lazy-demo", version: "0.5.0" });

  // Register a normal (non-lazy) command for demonstration
  cli.registerCommand(
    ["ping"],
    (_args, _flags, ctx) => {
      ctx.log("pong");
    },
    { description: "Ping–pong example" },
  );

  // Register a lazy‐loaded “compute sum” command.
  // The actual implementation lives in src/commands/sum.ts,
  // and we only import it when “lazy-demo compute sum” is invoked.
  cli.registerLazyCommand(
    ["compute", "sum"],
    "./src/commands/sum.ts", // relative path to the module
    "sumCommand", // exported symbol in sum.ts
    {
      description: "Compute the sum of a list of numbers",
      // Example usage will be shown in help
      examples: ["compute sum --numbers=1,2,3,4"],
    },
  );

  await cli.run(Deno.args);
}

if (import.meta.main) {
  main();
}
