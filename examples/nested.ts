import { z } from "zod";
import { CLI, CLIError } from "@ggpwnkthx/generic-cli";

// Schema for the “user add” command
const addUserFlagsSchema = z.object({
  username: z.string().min(1, "username is required"),
  email: z.string().email("must be a valid email address"),
  admin: z.boolean().optional().default(false),
});

// Schema for the “user remove” command
const removeUserFlagsSchema = z.object({
  username: z.string().min(1, "username is required"),
  force: z.boolean().optional().default(false),
});

async function main() {
  const cli = new CLI({ name: "user-manager", version: "2.0.0" });

  // Register `user add` command
  cli.registerCommand(
    ["user", "add"],
    (_args, flags, ctx) => {
      const { username, email, admin } = flags as {
        username: string;
        email: string;
        admin: boolean;
      };

      // Simulate a check: if the user already exists, throw a CLIError
      if (username === "existingUser") {
        throw new CLIError(`User "${username}" already exists.`, 2);
      }

      // Otherwise, pretend to add the user
      ctx.log(
        `Adding user: ${username} (${email})${admin ? " [admin]" : ""}`,
      );
      // In real code, you might write to a database or call an API here.
    },
    {
      description: "Add a new user to the system",
      examples: [
        "user add --username=jdoe --email=jdoe@example.com",
        "user add --username=alice --email=alice@example.com --admin",
      ],
      flagsSchema: addUserFlagsSchema,
    },
  );

  // Register `user remove` command, with an alias “rm”
  cli.registerCommand(
    ["user", "remove"],
    (_args, flags, ctx) => {
      const { username, force } = flags as {
        username: string;
        force: boolean;
      };

      if (!force) {
        ctx.warn(
          `Removing user "${username}" without --force. Proceed carefully!`,
        );
      }

      // Pretend to remove the user
      ctx.log(`Removed user: ${username}`);
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
