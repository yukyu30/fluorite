import { pathToFileURL } from "node:url";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import type { FluoriteConfig } from "./types.js";

/**
 * Identity helper for authoring a config file with full type inference:
 *
 * ```ts
 * import { defineConfig } from "fluorite";
 * export default defineConfig({
 *   include: ["docs/**\/*.md"],
 *   rules: (fm) => fm.key("title").required(),
 * });
 * ```
 */
export function defineConfig(config: FluoriteConfig): FluoriteConfig {
  return config;
}

const CONFIG_NAMES = [
  "fluorite.config.js",
  "fluorite.config.mjs",
  "fluorite.config.cjs",
];

/**
 * Locate a config file: an explicit path, or the first conventional name found
 * in `cwd`. Returns `undefined` when none is found.
 */
export async function resolveConfigPath(
  explicit: string | undefined,
  cwd = process.cwd(),
): Promise<string | undefined> {
  if (explicit) return resolve(cwd, explicit);
  for (const name of CONFIG_NAMES) {
    const candidate = resolve(cwd, name);
    if (await fileExists(candidate)) return candidate;
  }
  return undefined;
}

/** Dynamically import a config file and return its default export. */
export async function loadConfig(path: string): Promise<FluoriteConfig> {
  const mod = await import(pathToFileURL(path).href);
  const config = (mod.default ?? mod) as FluoriteConfig;
  if (!config || typeof config.rules !== "function") {
    throw new Error(
      `Config at ${path} must export a default object with a "rules" function.`,
    );
  }
  return config;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
