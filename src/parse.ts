import matter from "gray-matter";
import yaml from "js-yaml";

/**
 * gray-matter's default YAML engine follows YAML 1.1 and coerces unquoted
 * dates (`date: 2026-06-07`) into JavaScript `Date` objects. That erases how
 * the value was written, so the format can no longer be linted — a clean
 * `YYYY-MM-DD`, a full timestamp, and an impossible date all collapse to a
 * `Date` (or get silently re-serialised).
 *
 * We swap in js-yaml's `CORE_SCHEMA`, which omits the `!!timestamp` type, so
 * every date stays a verbatim string. Matchers like `isoDate()` / `matches()`
 * can then validate the written `YYYY-MM-DD` form without requiring every
 * value to be quoted. Booleans, numbers and `null` are still parsed.
 */
const keepDatesAsStrings = (input: string): object =>
  (yaml.load(input, { schema: yaml.CORE_SCHEMA }) as object) ?? {};

/** Outcome of parsing frontmatter out of a Markdown source string. */
export interface ParseResult {
  /** Parsed frontmatter data (empty object when none / on error). */
  data: Record<string, unknown>;
  /** The Markdown body following the frontmatter block. */
  content: string;
  /** Whether a frontmatter block was present at all. */
  hasFrontmatter: boolean;
  /** Parse error message, if the frontmatter (YAML) was malformed. */
  error?: string;
}

/**
 * Extract frontmatter from a Markdown source string.
 *
 * Never throws: malformed YAML is reported via the `error` field so callers
 * can record it as a failure rather than crash.
 */
export function parseFrontmatter(source: string): ParseResult {
  const hasFrontmatter = /^﻿?\s*---\r?\n/.test(source);
  try {
    const parsed = matter(source, { engines: { yaml: keepDatesAsStrings } });
    const data = (parsed.data ?? {}) as Record<string, unknown>;
    return {
      data,
      content: parsed.content,
      hasFrontmatter,
    };
  } catch (err) {
    return {
      data: {},
      content: source,
      hasFrontmatter,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
