import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { glob } from "tinyglobby";
import { check } from "./check.js";
import { loadConfig, resolveConfigPath } from "./config.js";
import { formatReports, type FileReport } from "./report.js";
import type { FluoriteConfig } from "./types.js";

export const HELP = `fluorite — inspect and validate Markdown frontmatter

Usage:
  fluorite check [patterns...] [options]

Options:
  -c, --config <path>   Path to a config file (default: fluorite.config.{js,mjs,cjs})
  -q, --quiet           Only print files with failures
  -h, --help            Show this help

Examples:
  fluorite check "docs/**/*.md"
  fluorite check --config fluorite.config.mjs
`;

/**
 * Run the `fluorite` CLI. Returns the process exit code (`0` on success, `1`
 * on any file/rule failure or usage error) instead of calling `process.exit`,
 * so it can be driven and asserted on from tests.
 */
export async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string", short: "c" },
      quiet: { type: "boolean", short: "q", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const command = positionals[0];
  if (command !== "check") {
    process.stderr.write(
      command
        ? `Unknown command: ${command}\n\n${HELP}`
        : HELP,
    );
    return command ? 1 : 0;
  }

  const cliPatterns = positionals.slice(1);

  // Load config (required for the rule set).
  const configPath = await resolveConfigPath(values.config);
  if (!configPath) {
    process.stderr.write(
      "No config file found. Create fluorite.config.mjs (export default defineConfig({ rules })) " +
        "or pass --config.\n",
    );
    return 1;
  }

  let config: FluoriteConfig;
  try {
    config = await loadConfig(configPath);
  } catch (err) {
    process.stderr.write(
      `Failed to load config: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }

  const patterns =
    cliPatterns.length > 0
      ? cliPatterns
      : config.include ?? ["**/*.md"];

  const files = await glob(patterns, {
    ignore: config.exclude ?? ["**/node_modules/**"],
  });
  files.sort();

  if (files.length === 0) {
    process.stderr.write(`No files matched: ${patterns.join(", ")}\n`);
    return 1;
  }

  const reports: FileReport[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    reports.push({ file, result: check(source, config.rules) });
  }

  process.stdout.write(formatReports(reports, { quiet: values.quiet }) + "\n");

  return reports.some((r) => !r.result.ok) ? 1 : 0;
}
