/** The set of value types understood by the `type()` matcher. */
export type ValueType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "null";

/** Result of a single matcher invocation against one key. */
export interface RuleResult {
  /** The frontmatter key that was inspected, e.g. `"tags"`. */
  key: string;
  /** The matcher name, e.g. `"has"` or `"lengthMin"`. */
  rule: string;
  /** Whether the check passed. */
  ok: boolean;
  /** Whether the matcher was reached through `.not`. */
  negated: boolean;
  /** Human readable description of the outcome. */
  message: string;
  /** The actual value found at `key`. */
  value: unknown;
  /** The expected value / argument passed to the matcher, if any. */
  expected?: unknown;
}

/** Aggregated outcome of running a rule set against one frontmatter object. */
export interface CheckResult {
  /** True when every recorded rule passed. */
  ok: boolean;
  /** Every rule result, in the order they were recorded. */
  results: RuleResult[];
  /** Only the failing rule results. */
  failures: RuleResult[];
  /** The parsed frontmatter data. */
  data: Record<string, unknown>;
}

/** A rule set: receives the recorder (`fm`) and registers matchers. */
export type RulesFn = (fm: import("./recorder.js").Recorder) => void;

/** Configuration accepted by `defineConfig` / consumed by the CLI. */
export interface FluoriteConfig {
  /** Glob patterns of Markdown files to check. */
  include?: string[];
  /** Glob patterns to exclude. */
  exclude?: string[];
  /** The rule set applied to every file's frontmatter. */
  rules: RulesFn;
}
