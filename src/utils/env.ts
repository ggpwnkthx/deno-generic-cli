/**
 * src/utils/env.ts
 *
 * Convert environment variables prefixed with <NAME>_ into an overrides object.
 */

/**
 * Parse primitive env strings into booleans/numbers where obvious.
 *
 * @param v - The raw environment variable string.
 * @returns Parsed value: boolean if "true"/"false", number if numeric, else original string.
 */
function parseEnvValue(v: string): unknown {
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === "true";
  const num = Number(v);
  if (!Number.isNaN(num)) return num;
  return v;
}

/**
 * Load environment variables prefixed by `<prefix>_`, case-insensitive to '-',
 * and translate them into lower-case config keys.
 *
 *   GENERIC_CLI_FOO=bar  -> { foo: "bar" }
 *   generic-cli_BAR=1    -> { bar: 1 }
 *
 * @param prefix - The prefix to match (e.g., "generic-cli").
 * @returns A Record<string, unknown> mapping parsed environment overrides.
 */
export function loadEnvOverrides(prefix: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const up = prefix.replace(/-/g, "_").toUpperCase();
  if (Deno.permissions.querySync({ name: "env" }).state === "granted") {
    for (const [k, v] of Object.entries(Deno.env.toObject())) {
      if (k.startsWith(`${up}_`)) {
        const key = k.slice(up.length + 1).toLowerCase();
        out[key] = parseEnvValue(v);
      }
    }
  }
  return out;
}
