import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../src/parse.js";

describe("parseFrontmatter", () => {
  it("extracts YAML frontmatter", () => {
    const r = parseFrontmatter(`---\ntitle: hi\ntags:\n  - a\n  - b\n---\nbody`);
    expect(r.hasFrontmatter).toBe(true);
    expect(r.data).toEqual({ title: "hi", tags: ["a", "b"] });
    expect(r.content.trim()).toBe("body");
    expect(r.error).toBeUndefined();
  });

  it("reports no frontmatter for plain markdown", () => {
    const r = parseFrontmatter("# heading\n\ntext");
    expect(r.hasFrontmatter).toBe(false);
    expect(r.data).toEqual({});
  });

  it("captures malformed YAML as an error without throwing", () => {
    const r = parseFrontmatter(`---\ntitle: "unterminated\n---\nbody`);
    expect(r.error).toBeDefined();
    expect(r.data).toEqual({});
  });

  it("detects frontmatter even after a leading BOM", () => {
    const r = parseFrontmatter(`﻿---\ntitle: hi\n---\nbody`);
    expect(r.hasFrontmatter).toBe(true);
  });

  it("handles an empty frontmatter block", () => {
    const r = parseFrontmatter(`---\n---\nbody`);
    expect(r.hasFrontmatter).toBe(true);
    expect(r.data).toEqual({});
  });

  it("preserves the body content after the block", () => {
    const r = parseFrontmatter(`---\ntitle: hi\n---\n# Heading\n\ntext`);
    expect(r.content).toContain("# Heading");
    expect(r.content).toContain("text");
  });

  it("keeps an unquoted date as a YYYY-MM-DD string, not a Date", () => {
    const r = parseFrontmatter(`---\ndate: 2026-06-07\n---\nbody`);
    expect(r.data.date).toBe("2026-06-07");
    expect(typeof r.data.date).toBe("string");
    expect(r.data.date instanceof Date).toBe(false);
  });

  it("keeps an unquoted date-time value verbatim", () => {
    const r = parseFrontmatter(`---\nstamp: 2026-06-07 10:30:00\n---\nbody`);
    expect(r.data.stamp).toBe("2026-06-07 10:30:00");
  });

  it("keeps arrays of dates as strings", () => {
    const r = parseFrontmatter(`---\ndates:\n  - 2026-01-02\n  - 2026-02-03\n---\nbody`);
    expect(r.data.dates).toEqual(["2026-01-02", "2026-02-03"]);
  });

  it("still parses booleans, numbers and null", () => {
    const r = parseFrontmatter(`---\ndraft: true\nn: 42\nempty: null\n---\nbody`);
    expect(r.data).toEqual({ draft: true, n: 42, empty: null });
  });
});
