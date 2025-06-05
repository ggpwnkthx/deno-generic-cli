import { z } from "zod";
import { CLI } from "@ggpwnkthx/generic-cli";

/**
 * Define a Zod schema for flags.
 * We expect a single string flag: --name
 */
const greetFlagsSchema = z.object({
  name: z.string().optional().default("World"),
});

async function main() {
  // Instantiate the CLI with name and version.
  const cli = new CLI({ name: "simple-greeter", version: "1.0.0" });

  // Register a “greet” command at path ["greet"].
  // When the user runs: simple-greeter greet --name=Alice
  // It will print “Hello, Alice!”
  cli.registerCommand(
    ["greet"],
    (_args, flags, ctx) => {
      // args: any positional arguments (none in this case)
      // flags: validated object { name: string }
      const name = (flags as { name: string }).name;
      ctx.log(`Hello, ${name}!`);
    },
    {
      description: "Print a greeting",
      flagsSchema: greetFlagsSchema,
    },
  );

  // Run the CLI with Deno.args
  await cli.run(Deno.args);
}

if (import.meta.main) {
  main();
}
