import matter from "gray-matter";

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
    const parsed = matter(source);
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
