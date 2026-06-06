import pc from "picocolors";
import type { CheckResult } from "./types.js";

/** A check result paired with the file it came from. */
export interface FileReport {
  file: string;
  result: CheckResult;
}

export interface FormatOptions {
  /** Suppress per-file lines for passing files. */
  quiet?: boolean;
}

function displayValue(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Format file reports into a human-readable, colorized string. */
export function formatReports(
  reports: FileReport[],
  options: FormatOptions = {},
): string {
  const lines: string[] = [];
  let passed = 0;
  let failed = 0;
  let ruleFailures = 0;

  for (const { file, result } of reports) {
    if (result.ok) {
      passed++;
      if (!options.quiet) lines.push(`${pc.green("✔")} ${file}`);
    } else {
      failed++;
      lines.push(`${pc.red("✘")} ${file}`);
      for (const failure of result.failures) {
        ruleFailures++;
        const where = pc.dim(`(value: ${displayValue(failure.value)})`);
        lines.push(
          `  ${pc.red("✘")} ${pc.bold(failure.key)}: ${failure.message} ${where}`,
        );
      }
    }
  }

  const summary = [
    `${reports.length} files`,
    pc.green(`${passed} passed`),
    failed > 0 ? pc.red(`${failed} failed`) : `${failed} failed`,
    `${ruleFailures} rule failures`,
  ].join(", ");

  lines.push("");
  lines.push(summary);
  return lines.join("\n");
}
