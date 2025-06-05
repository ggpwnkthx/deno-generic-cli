/**
 * src/cli/packageInfo.ts
 *
 * Attempts to auto-load `name` and `version` from deno.json / deno.jsonc
 * if the user didn't pass them explicitly into the CLI constructor.
 */

import { exists } from "@std/fs";
import { parse as parseJsonc } from "@std/jsonc";

interface PackageData {
  name?: string;
  version?: string;
}

/**
 * If the provided `currentName` / `currentVersion` are still the defaults
 * ("generic-cli" / "0.0.0"), look for deno.json or deno.jsonc at project root,
 * parse it, and return any overridden values. If none found or parse fails, return {}.
 *
 * @param currentName    the existing `this.name` in the CLI instance
 * @param currentVersion the existing `this.version` in the CLI instance
 * @returns an object with possibly updated `{ name, version }`
 */
export async function loadPackageInfo(
  currentName: string,
  currentVersion: string,
): Promise<PackageData> {
  // If neither is default, do nothing.
  if (currentName !== "generic-cli" && currentVersion !== "0.0.0") {
    return {};
  }

  const candidates = ["./deno.json", "./deno.jsonc"];
  for (const file of candidates) {
    try {
      if (await exists(file)) {
        const raw = await Deno.readTextFile(file);
        const data = file.endsWith(".jsonc")
          ? parseJsonc(raw)
          : JSON.parse(raw);
        const result: PackageData = {};
        if (typeof data.name === "string") {
          result.name = data.name;
        }
        if (typeof data.version === "string") {
          result.version = data.version;
        }
        return result;
      }
    } catch {
      // ignore errors (permission, parse errors, etc.) and continue to next candidate
    }
  }

  return {};
}
