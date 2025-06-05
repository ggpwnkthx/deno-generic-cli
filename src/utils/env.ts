/**
 * src/utils/env.ts
 *
 * Convert environment variables prefixed with <NAME>_ into an overrides object.
 */

/** Parse primitive env strings into booleans/numbers where obvious. */
function parseEnvValue(v: string): unknown {
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === "true";
  const num = Number(v);
  if (!Number.isNaN(num)) return num;
  return v;
}

/**
 * Load environment variables prefixed by <prefix>_, case-insensitive to '-', and
 * translate them into lower-case config keys.
 *
 *   GENERIC_CLI_FOO=bar  -> { foo: "bar" }
 *   generic-cli_BAR=1    -> { bar: 1 }
 */
export function loadEnvOverrides(prefix: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const up = prefix.replace(/-/g, "_").toUpperCase();

  for (const [k, v] of Object.entries(Deno.env.toObject())) {
    if (k.startsWith(`${up}_`)) {
      const key = k.slice(up.length + 1).toLowerCase();
      out[key] = parseEnvValue(v);
    }
  }
  return out;
}
