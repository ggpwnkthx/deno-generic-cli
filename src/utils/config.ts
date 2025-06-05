/**
 * src/utils/config.ts
 *
 * Load YAML configuration following XDG conventions with fall-backs.
 */

import { exists } from "@std/fs";
import { parse as parseYAML } from "@std/yaml";

/**
 * Attempt to load a YAML config at:
 *   $XDG_CONFIG_HOME/<name>/config.yaml
 *   ~/.<name>/config.yaml
 * (plus .yml variants)
 *
 * If `explicitPath` is provided it's tried first (and *only* if supplied).
 * Returns an empty object on any error.
 *
 * @param name - The base name of the application (e.g., "my-cli").
 * @param explicitPath - An explicit path to a YAML config file.
 * @returns A Record<string, unknown> representing parsed config, or {} on error.
 */
export async function loadConfigFile(
  name: string,
  explicitPath?: string,
): Promise<Record<string, unknown>> {
  const home =
    (await Deno.permissions.query({ name: "env", variable: "HOME" })).state ===
        "granted"
      ? Deno.env.get("HOME")
      : "";
  const xdg =
    (await Deno.permissions.query({ name: "env", variable: "XDG_CONFIG_HOME" }))
        .state ===
        "granted"
      ? Deno.env.get("XDG_CONFIG_HOME")
      : (home ? `${home}/.config` : "");

  const candidates: string[] = [];
  if (explicitPath) {
    candidates.push(explicitPath);
  } else {
    if (xdg) {
      candidates.push(
        `${xdg}/${name}/config.yaml`,
        `${xdg}/${name}/config.yml`,
      );
    }
    if (home) {
      candidates.push(
        `${home}/.${name}/config.yaml`,
        `${home}/.${name}/config.yml`,
      );
    }
  }

  for (const file of candidates) {
    try {
      if (
        Deno.permissions.querySync({ name: "read", path: file })
            .state ===
          "granted" && await exists(file)
      ) {
        const raw = await Deno.readTextFile(file);
        const parsed = parseYAML(raw);
        if (typeof parsed === "object" && parsed !== null) {
          return parsed as Record<string, unknown>;
        }
      }
    } catch {
      /* ignore parse / IO errors */
    }
  }
  return {};
}
