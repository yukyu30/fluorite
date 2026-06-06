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
});
